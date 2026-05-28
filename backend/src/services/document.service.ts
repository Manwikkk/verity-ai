/**
 * Document service: upload, process, list, delete documents.
 * Handles the full ingestion pipeline with status tracking.
 */
import { prisma } from "../utils/prisma.js";
import { extractText } from "../utils/pdf-extract.js";
import { chunkText } from "../rag/chunker.js";
import { embedTexts } from "../rag/embeddings.js";
import { NotFoundError } from "../utils/errors.js";
import { logAudit } from "./audit.service.js";
import { logger } from "../utils/logger.js";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const UPLOAD_DIR = join(process.cwd(), "uploads");

// Status indices matching frontend stages array
const STATUS_MAP = {
  UPLOADING: 0,
  EXTRACTING_TEXT: 1,
  CHUNKING: 2,
  EMBEDDING: 3,
  INDEXING: 4,
  SECURING: 5,
  READY: 6,
  FAILED: -1,
} as const;

export interface DocumentDTO {
  id: string;
  name: string;
  size: string;
  pages: number;
  owner: string;
  updated: string;
  status: number;
  chunks: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
}

/** List all documents for a tenant. */
export async function listDocuments(tenantId: string): Promise<DocumentDTO[]> {
  const docs = await prisma.document.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return docs.map(toDTO);
}

/** Get a single document. */
export async function getDocument(tenantId: string, docId: string): Promise<DocumentDTO> {
  const doc = await prisma.document.findFirst({
    where: { id: docId, tenantId },
  });
  if (!doc) throw new NotFoundError("Document");
  return toDTO(doc);
}

/** Get file bytes for download. */
export async function downloadDocument(tenantId: string, docId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: docId, tenantId },
  });
  if (!doc || !doc.storagePath) throw new NotFoundError("Document");

  const buffer = await readFile(doc.storagePath);
  return {
    buffer,
    fileName: doc.name,
    mimeType: doc.mimeType || "application/octet-stream",
  };
}

/** Get document processing status. */
export async function getDocumentStatus(tenantId: string, docId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: docId, tenantId },
    select: { id: true, status: true, chunkCount: true, pageCount: true, name: true },
  });
  if (!doc) throw new NotFoundError("Document");
  return {
    id: doc.id,
    name: doc.name,
    status: STATUS_MAP[doc.status],
    statusLabel: doc.status,
    chunks: doc.chunkCount,
    pages: doc.pageCount,
  };
}

/** Delete a document and all its chunks. */
export async function deleteDocument(
  tenantId: string,
  docId: string,
  userId?: string,
): Promise<void> {
  const doc = await prisma.document.findFirst({ where: { id: docId, tenantId } });
  if (!doc) throw new NotFoundError("Document");

  // Delete chunks first (cascade should handle, but be explicit)
  await prisma.documentChunk.deleteMany({ where: { documentId: docId, tenantId } });
  await prisma.document.delete({ where: { id: docId } });

  // Try to delete the stored file
  if (doc.storagePath) {
    try { await unlink(doc.storagePath); } catch { /* ignore */ }
  }

  await logAudit("document_delete", { tenantId, userId, details: { docId, name: doc.name } });
  logger.info("Document deleted", { tenantId, docId, name: doc.name });
}

/**
 * Upload and process a document through the full pipeline.
 * Updates status at each stage for frontend progress tracking.
 */
export async function uploadDocument(
  tenantId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
  owner: string = "Unknown",
  userId?: string,
): Promise<DocumentDTO> {
  // Stage 0: UPLOADING — create record and save file
  await mkdir(UPLOAD_DIR, { recursive: true });
  const storagePath = join(UPLOAD_DIR, `${tenantId}_${Date.now()}_${fileName}`);

  const doc = await prisma.document.create({
    data: {
      tenantId,
      name: fileName,
      mimeType,
      sizeBytes: fileBuffer.length,
      owner,
      status: "UPLOADING",
      storagePath,
    },
  });

  await writeFile(storagePath, fileBuffer);
  await logAudit("document_upload", { tenantId, userId, details: { docId: doc.id, name: fileName } });

  // Process asynchronously — don't block the upload response
  processDocumentPipeline(doc.id, tenantId, fileBuffer, mimeType).catch((err) => {
    logger.error("Document processing failed", { docId: doc.id, error: (err as Error).message });
  });

  return toDTO(doc);
}

/** Run the full processing pipeline (async, updates status at each step). */
async function processDocumentPipeline(
  docId: string,
  tenantId: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<void> {
  try {
    // Stage 1: EXTRACTING_TEXT
    await updateStatus(docId, "EXTRACTING_TEXT");
    const extracted = await extractText(fileBuffer, mimeType);

    await prisma.document.update({
      where: { id: docId },
      data: { pageCount: extracted.pageCount },
    });

    // Stage 2: CHUNKING
    await updateStatus(docId, "CHUNKING");
    const chunks = chunkText(extracted.text);

    // Stage 3: EMBEDDING
    await updateStatus(docId, "EMBEDDING");
    const embeddings = await embedTexts(chunks.map((c) => c.content));

    // Stage 4: INDEXING
    await updateStatus(docId, "INDEXING");
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO document_chunks (id, document_id, tenant_id, content, page_number, chunk_index, token_count, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW())`,
        crypto.randomUUID(),
        docId,
        tenantId,
        chunk.content,
        chunk.pageNumber ?? null,
        chunk.chunkIndex,
        chunk.tokenCount,
        embeddingStr,
      );
    }

    await prisma.document.update({
      where: { id: docId },
      data: { chunkCount: chunks.length },
    });

    // Stage 5: SECURING
    await updateStatus(docId, "SECURING");
    // Verify all chunks have correct tenantId
    const badChunks = await prisma.documentChunk.count({
      where: { documentId: docId, NOT: { tenantId } },
    });
    if (badChunks > 0) {
      logger.error("SECURITY: Chunks with wrong tenantId detected!", { docId, tenantId, badChunks });
      await prisma.documentChunk.deleteMany({ where: { documentId: docId, NOT: { tenantId } } });
    }

    // Stage 6: READY
    await updateStatus(docId, "READY");
    logger.info("Document processing complete", { docId, tenantId, chunks: chunks.length });
  } catch (err) {
    logger.error("Document pipeline failed", { docId, error: (err as Error).message });
    await updateStatus(docId, "FAILED");
  }
}

async function updateStatus(docId: string, status: string): Promise<void> {
  await prisma.document.update({
    where: { id: docId },
    data: { status: status as any },
  });
}

function toDTO(doc: any): DocumentDTO {
  const sizeBytes = doc.sizeBytes || 0;
  const size = sizeBytes > 1024 * 1024
    ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(sizeBytes / 1024)} KB`;

  const now = Date.now();
  const diff = now - new Date(doc.updatedAt || doc.createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const updated = hours < 1 ? "Just now" : hours < 24 ? `${hours} hours ago` : `${Math.floor(hours / 24)} days ago`;

  return {
    id: doc.id,
    name: doc.name,
    size,
    pages: doc.pageCount || 0,
    owner: doc.owner || "Unknown",
    updated,
    status: STATUS_MAP[doc.status as keyof typeof STATUS_MAP] ?? 0,
    chunks: doc.chunkCount || 0,
    mimeType: doc.mimeType,
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt || doc.createdAt).getTime(),
  };
}
