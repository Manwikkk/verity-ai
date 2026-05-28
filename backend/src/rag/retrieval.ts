/**
 * Hybrid retrieval: combines pgvector similarity search with
 * PostgreSQL full-text search, then merges and deduplicates.
 */
import { prisma } from "../utils/prisma.js";
import { embedText } from "./embeddings.js";
import { logger } from "../utils/logger.js";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  tenantId: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  tokenCount: number;
  score: number;
  source: "vector" | "keyword";
  documentName?: string;
  documentOwner?: string;
}

/**
 * Hybrid retrieval: vector + keyword search, merged and deduplicated.
 * ALL queries are tenant-scoped — cross-tenant retrieval is impossible.
 */
export async function hybridRetrieve(
  tenantId: string,
  query: string,
  topK: number = 20,
): Promise<RetrievedChunk[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(tenantId, query, topK),
    keywordSearch(tenantId, query, topK),
  ]);

  // Merge and deduplicate by chunk ID
  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];

  for (const chunk of [...vectorResults, ...keywordResults]) {
    if (!seen.has(chunk.id)) {
      seen.add(chunk.id);
      merged.push(chunk);
    }
  }

  logger.debug("Hybrid retrieval complete", {
    tenantId,
    vectorHits: vectorResults.length,
    keywordHits: keywordResults.length,
    mergedTotal: merged.length,
  });

  return merged;
}

/** Vector similarity search using pgvector cosine distance. */
async function vectorSearch(
  tenantId: string,
  query: string,
  limit: number,
): Promise<RetrievedChunk[]> {
  try {
    const queryEmbedding = await embedText(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        document_id: string;
        tenant_id: string;
        content: string;
        page_number: number | null;
        chunk_index: number;
        token_count: number;
        distance: number;
        doc_name: string;
        doc_owner: string;
      }>
    >(
      `SELECT dc.id, dc.document_id, dc.tenant_id, dc.content,
              dc.page_number, dc.chunk_index, dc.token_count,
              dc.embedding <=> $1::vector AS distance,
              d.name AS doc_name, d.owner AS doc_owner
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.tenant_id = $2
         AND dc.embedding IS NOT NULL
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      embeddingStr,
      tenantId,
      limit,
    );

    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      tenantId: r.tenant_id,
      content: r.content,
      pageNumber: r.page_number,
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      score: 1 - r.distance, // cosine similarity = 1 - cosine distance
      source: "vector" as const,
      documentName: r.doc_name,
      documentOwner: r.doc_owner,
    }));
  } catch (err) {
    logger.error("Vector search failed", { error: (err as Error).message, tenantId });
    return [];
  }
}

/** Full-text keyword search using PostgreSQL tsvector. */
async function keywordSearch(
  tenantId: string,
  query: string,
  limit: number,
): Promise<RetrievedChunk[]> {
  try {
    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        document_id: string;
        tenant_id: string;
        content: string;
        page_number: number | null;
        chunk_index: number;
        token_count: number;
        rank: number;
        doc_name: string;
        doc_owner: string;
      }>
    >(
      `SELECT dc.id, dc.document_id, dc.tenant_id, dc.content,
              dc.page_number, dc.chunk_index, dc.token_count,
              ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', $1)) AS rank,
              d.name AS doc_name, d.owner AS doc_owner
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.tenant_id = $2
         AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $3`,
      query,
      tenantId,
      limit,
    );

    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      tenantId: r.tenant_id,
      content: r.content,
      pageNumber: r.page_number,
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      score: Math.min(r.rank, 1), // normalize
      source: "keyword" as const,
      documentName: r.doc_name,
      documentOwner: r.doc_owner,
    }));
  } catch (err) {
    logger.error("Keyword search failed", { error: (err as Error).message, tenantId });
    return [];
  }
}
