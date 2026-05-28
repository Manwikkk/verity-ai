/**
 * Confidence scoring: combines reranker scores, retrieval quality,
 * and source diversity into a single confidence value.
 */
import type { RankedChunk } from "./reranker.js";

export interface ConfidenceResult {
  overallConfidence: number;
  perSourceConfidence: number[];
  isLowConfidence: boolean;
  isEmpty: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Compute confidence scores from ranked chunks.
 */
export function computeConfidence(chunks: RankedChunk[]): ConfidenceResult {
  if (chunks.length === 0) {
    return {
      overallConfidence: 0,
      perSourceConfidence: [],
      isLowConfidence: true,
      isEmpty: true,
    };
  }

  // Per-source confidence: normalize reranker scores to 0-1 range
  const maxScore = Math.max(...chunks.map((c) => c.rerankerScore), 0.01);
  const perSourceConfidence = chunks.map((c) =>
    Math.round(Math.min(c.rerankerScore / maxScore, 1) * 100) / 100,
  );

  // Overall confidence: weighted average favoring top results
  const weights = chunks.map((_, i) => 1 / (i + 1)); // 1, 0.5, 0.33, ...
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const weightedAvg =
    chunks.reduce((sum, c, i) => sum + (c.rerankerScore / maxScore) * weights[i], 0) / weightSum;

  // Boost for source diversity (different documents)
  const uniqueDocs = new Set(chunks.map((c) => c.documentId)).size;
  const diversityBonus = Math.min(uniqueDocs / 3, 1) * 0.1;

  const overallConfidence = Math.round(Math.min(weightedAvg + diversityBonus, 1) * 100) / 100;

  return {
    overallConfidence,
    perSourceConfidence,
    isLowConfidence: overallConfidence < LOW_CONFIDENCE_THRESHOLD,
    isEmpty: false,
  };
}
