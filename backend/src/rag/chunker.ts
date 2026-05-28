/**
 * Text chunker: splits extracted document text into overlapping chunks
 * suitable for embedding and retrieval.
 */

export interface Chunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  tokenCount: number;
}

/** Rough token count approximation (words ÷ 0.75). */
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length / 0.75);
}

/**
 * Split text into chunks of approximately `maxTokens` tokens
 * with `overlapTokens` overlap between consecutive chunks.
 */
export function chunkText(
  text: string,
  options: { maxTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const maxTokens = options.maxTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 50;

  // Split into paragraphs first for natural boundaries
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const combined = currentChunk ? `${currentChunk}\n\n${para}` : para;
    const tokens = estimateTokens(combined);

    if (tokens > maxTokens && currentChunk) {
      // Flush current chunk
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        tokenCount: estimateTokens(currentChunk),
      });
      chunkIndex++;

      // Start new chunk with overlap from the end of previous
      const words = currentChunk.split(/\s+/);
      const overlapWords = Math.floor(overlapTokens * 0.75);
      const overlapText = words.slice(-overlapWords).join(" ");
      currentChunk = overlapText ? `${overlapText}\n\n${para}` : para;
    } else {
      currentChunk = combined;
    }
  }

  // Flush final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  // If text was very short or a single paragraph, handle edge case
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      content: text.trim(),
      chunkIndex: 0,
      tokenCount: estimateTokens(text),
    });
  }

  return chunks;
}
