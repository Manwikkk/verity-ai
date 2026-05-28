/**
 * PDF text extraction using pdf-parse.
 * Returns extracted text and page count.
 */
import pdf from "pdf-parse";
import { readFile } from "node:fs/promises";
import { logger } from "./logger.js";

export interface ExtractedDocument {
  text: string;
  pageCount: number;
}

/** Extract text from a PDF file path. */
export async function extractPdfText(filePath: string): Promise<ExtractedDocument> {
  const buffer = await readFile(filePath);
  return extractPdfTextFromBuffer(buffer);
}

/** Extract text from a PDF buffer. */
export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    const data = await pdf(buffer);
    return {
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (err) {
    logger.error("PDF extraction failed", { error: (err as Error).message });
    throw new Error(`Failed to extract text from PDF: ${(err as Error).message}`);
  }
}

/**
 * Extract text from a plain text or markdown buffer.
 * Passthrough — no processing needed.
 */
export function extractPlainText(buffer: Buffer): ExtractedDocument {
  return {
    text: buffer.toString("utf8"),
    pageCount: 1,
  };
}

/** Determine extractor based on MIME type. */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractedDocument> {
  if (mimeType === "application/pdf") {
    return extractPdfTextFromBuffer(buffer);
  }
  // For plain text, markdown, docx (basic support)
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractPlainText(buffer);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}
