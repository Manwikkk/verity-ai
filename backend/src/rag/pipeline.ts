/**
 * RAG Pipeline Orchestrator: ties together guardrails, retrieval,
 * reranking, confidence scoring, and generation.
 */
import { checkGuardrails, validateTenantChunks } from "./guardrails.js";
import { hybridRetrieve } from "./retrieval.js";
import { rerankChunks, type RankedChunk } from "./reranker.js";
import { computeConfidence, type ConfidenceResult } from "./confidence.js";
import { streamGenerate, type StreamCallbacks } from "./generator.js";
import { logger } from "../utils/logger.js";

export interface PipelineSource {
  title: string;
  section: string;
  confidence: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  documentOwner: string;
  pageNumber: number | null;
  chunkText: string;
}

export interface PipelineResult {
  answer: string;
  sources: PipelineSource[];
  confidence: ConfidenceResult;
  blocked: boolean;
  blockReason?: string;
  blockThreat?: string;
  latencyMs: number;
}

/**
 * Execute the full RAG pipeline with streaming.
 * Tenant isolation is enforced at every step.
 */
export async function executePipeline(
  tenantId: string,
  query: string,
  callbacks: StreamCallbacks,
  options: {
    topK?: number;
    apiKey?: string;
    providerId?: string;
    model?: string;
  } = {},
): Promise<PipelineResult> {
  const start = Date.now();
  const topK = options.topK ?? 8;

  // Step 1: Guardrails check
  const guardrailResult = checkGuardrails(query);
  if (!guardrailResult.passed) {
    const message = guardrailResult.reason || "Request blocked by safety guardrails.";
    callbacks.onToken(message);
    callbacks.onDone();
    return {
      answer: message,
      sources: [],
      confidence: { overallConfidence: 0, perSourceConfidence: [], isLowConfidence: true, isEmpty: true },
      blocked: true,
      blockReason: guardrailResult.reason,
      blockThreat: guardrailResult.threat,
      latencyMs: Date.now() - start,
    };
  }

  // Step 2: Hybrid retrieval (tenant-scoped)
  const retrieved = await hybridRetrieve(tenantId, query, topK * 3);

  // Step 3: Tenant validation (defense-in-depth)
  if (!validateTenantChunks(retrieved, tenantId)) {
    const msg = "An internal safety check failed. Please try again.";
    callbacks.onToken(msg);
    callbacks.onDone();
    return {
      answer: msg,
      sources: [],
      confidence: { overallConfidence: 0, perSourceConfidence: [], isLowConfidence: true, isEmpty: true },
      blocked: true,
      blockReason: "Cross-tenant data detected in retrieval",
      blockThreat: "cross_tenant_leakage",
      latencyMs: Date.now() - start,
    };
  }

  // Step 4: Rerank
  const ranked = await rerankChunks(query, retrieved, topK);

  // Step 5: Confidence scoring
  const confidence = computeConfidence(ranked);

  // Step 6: Handle empty or low-confidence retrieval
  if (confidence.isEmpty) {
    const msg = "I couldn't find any relevant information in your organization's knowledge base for this query. Please try rephrasing or ensure the relevant documents have been uploaded.";
    callbacks.onToken(msg);
    callbacks.onDone();
    return {
      answer: msg,
      sources: [],
      confidence,
      blocked: false,
      latencyMs: Date.now() - start,
    };
  }

  if (confidence.isLowConfidence) {
    const msg = "I found some potentially relevant information, but my confidence is low. The available documents may not fully address your question. Here's what I found:\n\n";
    callbacks.onToken(msg);
  }

  // Step 7: Generate with streaming
  const answer = await streamGenerate(
    query,
    ranked,
    callbacks,
    options.apiKey,
    options.model,
    options.providerId,
  );
  const fullAnswer = confidence.isLowConfidence
    ? `I found some potentially relevant information, but my confidence is low. The available documents may not fully address your question. Here's what I found:\n\n${answer}`
    : answer;

  // Step 8: Build sources for frontend
  const sources = buildSources(ranked, confidence.perSourceConfidence);

  logger.info("RAG pipeline complete", {
    tenantId,
    queryLength: query.length,
    chunksRetrieved: retrieved.length,
    chunksReranked: ranked.length,
    confidence: confidence.overallConfidence,
    latencyMs: Date.now() - start,
  });

  return {
    answer: fullAnswer,
    sources,
    confidence,
    blocked: false,
    latencyMs: Date.now() - start,
  };
}

/** Convert ranked chunks into frontend-compatible source objects. */
function buildSources(
  chunks: RankedChunk[],
  confidences: number[],
): PipelineSource[] {
  return chunks.map((chunk, i) => ({
    title: chunk.documentName || "Unknown Document",
    section: `Chunk ${chunk.chunkIndex}${chunk.pageNumber ? ` · p. ${chunk.pageNumber}` : ""}`,
    confidence: confidences[i] ?? chunk.rerankerScore,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName || "Unknown",
    documentOwner: chunk.documentOwner || "Unknown",
    pageNumber: chunk.pageNumber,
    chunkText: chunk.content,
  }));
}
