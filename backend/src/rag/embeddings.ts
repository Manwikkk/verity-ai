/**
 * Local embedding model using @xenova/transformers.
 * Runs all-MiniLM-L6-v2 entirely in Node.js — no external API needed.
 * Output: 384-dimensional vectors.
 */
import { logger } from "../utils/logger.js";

let pipeline: any = null;

async function getEmbeddingPipeline() {
  if (!pipeline) {
    logger.info("Loading embedding model (all-MiniLM-L6-v2)...");
    const { pipeline: createPipeline } = await import("@xenova/transformers");
    pipeline = await createPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    logger.info("Embedding model loaded");
  }
  return pipeline;
}

/** Generate an embedding vector for a single text string. */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** Generate embeddings for multiple texts in batch. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  // Process in small batches to avoid OOM on large sets
  const BATCH = 32;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(embedText));
    results.push(...batchResults);
  }
  return results;
}

/** Embedding dimension for pgvector column. */
export const EMBEDDING_DIM = 384;
