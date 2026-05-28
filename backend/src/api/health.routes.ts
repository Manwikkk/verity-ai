import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { getRedis } from "../utils/redis.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (request, reply) => {
    const checks: Record<string, string> = {};

    // Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    // Redis
    try {
      const r = getRedis();
      await r.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }

    const allOk = Object.values(checks).every((v) => v === "ok");

    reply.status(allOk ? 200 : 503).send({
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
