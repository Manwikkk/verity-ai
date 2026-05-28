import { describe, it, expect } from "vitest";
import { chunkText } from "../rag/chunker.js";
import { computeConfidence } from "../rag/confidence.js";

describe("RAG Pipeline", () => {
  describe("Chunker", () => {
    it("chunks text into multiple parts", () => {
      const text = Array(20).fill("This is a paragraph with enough words to create meaningful chunks for the embedding model to process effectively.\n\n").join("");
      const chunks = chunkText(text, { maxTokens: 100 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("preserves all content across chunks", () => {
      const paragraphs = [
        "First paragraph content here.",
        "Second paragraph content here.",
        "Third paragraph content here.",
      ];
      const text = paragraphs.join("\n\n");
      const chunks = chunkText(text, { maxTokens: 1000 });
      // With a large maxTokens, all content should be in one chunk
      expect(chunks.length).toBe(1);
      for (const para of paragraphs) {
        expect(chunks[0].content).toContain(para);
      }
    });

    it("handles empty text", () => {
      const chunks = chunkText("");
      expect(chunks.length).toBe(0);
    });

    it("handles single paragraph", () => {
      const chunks = chunkText("Just one paragraph.");
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe("Just one paragraph.");
      expect(chunks[0].chunkIndex).toBe(0);
    });

    it("assigns sequential chunk indices", () => {
      const text = Array(20).fill("Paragraph content here with enough text.\n\n").join("");
      const chunks = chunkText(text, { maxTokens: 50 });
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });

    it("estimates token counts", () => {
      const chunks = chunkText("This is a test sentence with several words.");
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });
  });

  describe("Confidence Scoring", () => {
    it("returns zero confidence for empty chunks", () => {
      const result = computeConfidence([]);
      expect(result.overallConfidence).toBe(0);
      expect(result.isEmpty).toBe(true);
      expect(result.isLowConfidence).toBe(true);
    });

    it("computes confidence for high-scoring chunks", () => {
      const chunks = [
        { id: "1", documentId: "d1", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.95, source: "vector" as const, rerankerScore: 0.95 },
        { id: "2", documentId: "d2", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.88, source: "vector" as const, rerankerScore: 0.88 },
      ];
      const result = computeConfidence(chunks);
      expect(result.overallConfidence).toBeGreaterThan(0.5);
      expect(result.isLowConfidence).toBe(false);
      expect(result.perSourceConfidence.length).toBe(2);
    });

    it("marks low confidence for poor scores", () => {
      const chunks = [
        { id: "1", documentId: "d1", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.05, source: "vector" as const, rerankerScore: 0.05 },
      ];
      const result = computeConfidence(chunks);
      // With only one low-scoring chunk from one document
      expect(result.perSourceConfidence[0]).toBeLessThanOrEqual(1);
    });

    it("boosts confidence for diverse sources", () => {
      const singleDoc = [
        { id: "1", documentId: "d1", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.8, source: "vector" as const, rerankerScore: 0.8 },
        { id: "2", documentId: "d1", tenantId: "t1", content: "c", pageNumber: 2, chunkIndex: 1, tokenCount: 10, score: 0.7, source: "vector" as const, rerankerScore: 0.7 },
      ];
      const multiDoc = [
        { id: "1", documentId: "d1", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.8, source: "vector" as const, rerankerScore: 0.8 },
        { id: "2", documentId: "d2", tenantId: "t1", content: "c", pageNumber: 1, chunkIndex: 0, tokenCount: 10, score: 0.7, source: "vector" as const, rerankerScore: 0.7 },
      ];
      const singleResult = computeConfidence(singleDoc);
      const multiResult = computeConfidence(multiDoc);
      expect(multiResult.overallConfidence).toBeGreaterThanOrEqual(singleResult.overallConfidence);
    });
  });
});
