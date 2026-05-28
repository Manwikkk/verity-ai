import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTenantPermission } from "../middleware/tenant.middleware.js";
import { querySchema } from "../schemas/query.schema.js";
import { executeQuery } from "../services/query.service.js";

export async function queryRoutes(app: FastifyInstance) {
  /** POST /tenant/:tenantId/query — RAG query with SSE streaming */
  app.post(
    "/tenant/:tenantId/query",
    { preHandler: [requireAuth, requireTenantPermission("query")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = querySchema.parse(request.body);

      // Set up SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendSSE = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await executeQuery(tenantId, body.query, {
          onToken: (token) => sendSSE("token", { token }),
          onDone: () => {},
          onError: (error) => sendSSE("error", { message: error.message }),
        }, {
          userId: request.auth.isGuest ? undefined : request.auth.sub,
          chatId: body.chatId,
          providerId: body.providerId,
          topK: body.topK,
          isIncognito: false,
        });

        // Send final metadata
        sendSSE("sources", {
          sources: result.sources.map((s) => ({
            title: s.title,
            section: s.section,
            confidence: s.confidence,
          })),
          confidence: result.confidence.overallConfidence,
          chatId: result.chatId,
        });

        sendSSE("done", {});
      } catch (err) {
        sendSSE("error", { message: (err as Error).message });
      } finally {
        reply.raw.end();
      }
    },
  );

  /** POST /tenant/:tenantId/query/incognito — Ephemeral query, no persistence */
  app.post(
    "/tenant/:tenantId/query/incognito",
    { preHandler: [requireAuth, requireTenantPermission("query")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = querySchema.parse(request.body);

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendSSE = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await executeQuery(tenantId, body.query, {
          onToken: (token) => sendSSE("token", { token }),
          onDone: () => {},
          onError: (error) => sendSSE("error", { message: error.message }),
        }, {
          userId: request.auth.isGuest ? undefined : request.auth.sub,
          topK: body.topK,
          isIncognito: true,
        });

        sendSSE("sources", {
          sources: result.sources.map((s) => ({
            title: s.title,
            section: s.section,
            confidence: s.confidence,
          })),
          confidence: result.confidence.overallConfidence,
        });

        sendSSE("done", {});
      } catch (err) {
        sendSSE("error", { message: (err as Error).message });
      } finally {
        reply.raw.end();
      }
    },
  );
}
