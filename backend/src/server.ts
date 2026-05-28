/**
 * Verity Backend — Fastify server bootstrap.
 */
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { AppError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { getRedis, disconnectRedis } from "./utils/redis.js";
import { prisma } from "./utils/prisma.js";

// Route imports
import { healthRoutes } from "./api/health.routes.js";
import { authRoutes } from "./api/auth.routes.js";
import { tenantRoutes } from "./api/tenant.routes.js";
import { documentRoutes } from "./api/document.routes.js";
import { chatRoutes } from "./api/chat.routes.js";
import { queryRoutes } from "./api/query.routes.js";
import { searchRoutes } from "./api/search.routes.js";
import { settingsRoutes } from "./api/settings.routes.js";

function toErrorDetails(error: unknown): { message: string; stack?: string; statusCode?: number } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      statusCode:
        "statusCode" in error && typeof error.statusCode === "number"
          ? error.statusCode
          : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : "Unknown error",
      stack: typeof record.stack === "string" ? record.stack : undefined,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
    };
  }

  return { message: String(error) };
}

function getCorsOriginConfig(): string | string[] {
  const configured = process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return "*";
}

async function main() {
  const app = Fastify({
    logger: false, // We use our own logger
    bodyLimit: 50 * 1024 * 1024, // 50MB for document uploads
  });

  // ── Plugins ──
  await app.register(cors, {
    origin: getCorsOriginConfig(),
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 1,
    },
  });

  // ── Global error handler ──
  app.setErrorHandler((error, request, reply) => {
    const details = toErrorDetails(error);

    // Zod validation errors
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      reply.status(400).send({
        error: "Validation Error",
        code: "VALIDATION_ERROR",
        details: messages,
      });
      return;
    }

    // Custom application errors
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
      return;
    }

    // Fastify errors (rate limit, etc.)
    if (details.statusCode && details.statusCode < 500) {
      reply.status(details.statusCode).send({
        error: details.message,
        code: "REQUEST_ERROR",
      });
      return;
    }

    // Unexpected errors
    logger.error("Unhandled error", {
      error: details.message,
      stack: details.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(500).send({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });

  // ── Routes ──
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(tenantRoutes);
  await app.register(documentRoutes);
  await app.register(chatRoutes);
  await app.register(queryRoutes);
  await app.register(searchRoutes);
  await app.register(settingsRoutes);

  // ── Connect services ──
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (err) {
    logger.error("Database connection failed", { error: (err as Error).message });
  }

  try {
    const redis = getRedis();
    await redis.connect();
  } catch (err) {
    logger.warn("Redis connection failed — running without cache", {
      error: (err as Error).message,
    });
  }

  // ── Start ──
  const port = parseInt(process.env.PORT || "3001", 10);
  const host = process.env.HOST || "0.0.0.0";

  await app.listen({ port, host });
  logger.info(`Verity backend running on http://${host}:${port}`);

  // ── Graceful shutdown ──
  const shutdown = async () => {
    logger.info("Shutting down...");
    await app.close();
    await prisma.$disconnect();
    await disconnectRedis();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Failed to start server", {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  process.exit(1);
});
