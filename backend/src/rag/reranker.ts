/**
 * Cross-encoder reranker using Xenova/transformers.
 * Reranks candidate chunks by query–document relevance.
 */
import type { RetrievedChunk } from "./retrieval.js";
import { logger } from "../utils/logger.js";

let rerankerPipeline: any = null;

async function getReranker() {
  if (!rerankerPipeline) {
    logger.info("Loading reranker model (ms-marco-MiniLM-L-6-v2)...");
    try {
      const { pipeline } = await import("@xenova/transformers");
      rerankerPipeline = await pipeline(
        "text-classification",
        "Xenova/ms-marco-MiniLM-L-6-v2",
      );
      logger.info("Reranker model loaded");
    } catch (err) {
      logger.warn("Reranker model failed to load, falling back to score-based ranking", {
        error: (err as Error).message,
      });
      return null;
    }
  }
  return rerankerPipeline;
}

export interface RankedChunk extends RetrievedChunk {
  rerankerScore: number;
}

/**
 * Rerank retrieved chunks using a cross-encoder model.
 * Falls back to original scores if the model is unavailable.
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK: number = 8,
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return [];

  const reranker = await getReranker();

  let ranked: RankedChunk[];

  if (reranker) {
    // Cross-encoder scoring: score each (query, chunk) pair
    const scored = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const result = await reranker(`${query} [SEP] ${chunk.content.slice(0, 512)}`);
          const score = Array.isArray(result) && result[0]?.score != null
            ? result[0].score
            : chunk.score;
          return { ...chunk, rerankerScore: score };
        } catch {
          return { ...chunk, rerankerScore: chunk.score };
        }
      }),
    );

    ranked = scored.sort((a, b) => b.rerankerScore - a.rerankerScore);
  } else {
    // Fallback: use original retrieval scores
    ranked = chunks
      .map((c) => ({ ...c, rerankerScore: c.score }))
      .sort((a, b) => b.rerankerScore - a.rerankerScore);
  }

  logger.debug("Reranking complete", {
    inputChunks: chunks.length,
    outputChunks: Math.min(topK, ranked.length),
    topScore: ranked[0]?.rerankerScore,
  });

  return ranked.slice(0, topK);
}
