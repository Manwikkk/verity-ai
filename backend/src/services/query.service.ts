/**
 * Query service: orchestrates the RAG pipeline for user queries.
 */
import { executePipeline } from "../rag/pipeline.js";
import type { StreamCallbacks } from "../rag/generator.js";
import { addMessage, createChat } from "./chat.service.js";
import { logAudit } from "./audit.service.js";
import { prisma } from "../utils/prisma.js";
import { decrypt } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";

/**
 * Execute a RAG query with streaming and optional chat persistence.
 */
export async function executeQuery(
  tenantId: string,
  query: string,
  callbacks: StreamCallbacks,
  options: {
    userId?: string;
    chatId?: string;
    providerId?: string;
    topK?: number;
    isIncognito?: boolean;
  } = {},
) {
  const startTime = Date.now();

  // Resolve API key for the selected provider
  let apiKey: string | undefined;
  let model: string | undefined;
  if (options.providerId && options.providerId !== "groq") {
    const config = await prisma.providerConfig.findUnique({
      where: { tenantId_providerId: { tenantId, providerId: options.providerId } },
    });
    model = config?.model;
    if (config?.apiKeyEncrypted) {
      try {
        apiKey = decrypt(config.apiKeyEncrypted);
      } catch {
        logger.warn("Failed to decrypt API key", { tenantId, providerId: options.providerId });
      }
    }
  } else if (options.providerId === "groq") {
    const config = await prisma.providerConfig.findUnique({
      where: { tenantId_providerId: { tenantId, providerId: "groq" } },
    });
    model = config?.model;
  }

  // Persist user message if not incognito
  let chatId = options.chatId;
  if (!options.isIncognito && options.userId) {
    if (!chatId) {
      const chat = await createChat(tenantId, query.slice(0, 60), options.userId);
      chatId = chat.id;
    }
    await addMessage(chatId, "user", query, options.userId);
  }

  // Execute RAG pipeline
  const result = await executePipeline(tenantId, query, callbacks, {
    topK: options.topK,
    apiKey,
    providerId: options.providerId,
    model,
  });

  // Persist assistant message if not incognito
  if (!options.isIncognito && options.userId && chatId) {
    const frontendSources = result.sources.map((s) => ({
      title: s.title,
      section: s.section,
      confidence: s.confidence,
    }));

    await addMessage(
      chatId,
      "assistant",
      result.answer,
      undefined,
      frontendSources,
      result.confidence.overallConfidence,
    );
  }

  try {
    await prisma.queryLog.create({
      data: {
        tenantId,
        userId: options.userId ?? null,
        query: query.slice(0, 2000),
        confidence: result.confidence.overallConfidence,
        chunksUsed: result.sources.length,
        providerId: options.providerId ?? "groq",
        latencyMs: result.latencyMs,
        wasBlocked: result.blocked,
        blockReason: result.blockReason ?? null,
        isIncognito: options.isIncognito ?? false,
      },
    });
  } catch (err) {
    logger.warn("Failed to write query log", {
      tenantId,
      error: (err as Error).message,
    });
  }

  // Audit blocked queries
  if (result.blocked) {
    const auditAction = result.blockThreat === "prompt_injection"
      ? "prompt_injection_blocked"
      : result.blockThreat === "jailbreak"
        ? "jailbreak_blocked"
        : result.blockThreat === "cross_tenant_probe"
          ? "cross_tenant_denied"
          : "prompt_injection_blocked";

    await logAudit(auditAction as any, {
      tenantId,
      userId: options.userId,
      details: { query: query.slice(0, 200), threat: result.blockThreat },
    });
  } else if (result.confidence.isLowConfidence) {
    await logAudit("low_confidence_fallback", {
      tenantId,
      userId: options.userId,
      details: { query: query.slice(0, 200), confidence: result.confidence.overallConfidence },
    });
  }

  return { ...result, chatId };
}
