import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTenantPermission } from "../middleware/tenant.middleware.js";
import * as searchService from "../services/search.service.js";

export async function searchRoutes(app: FastifyInstance) {
  /** GET /tenant/:tenantId/search?q= */
  app.get(
    "/tenant/:tenantId/search",
    { preHandler: [requireAuth, requireTenantPermission("search")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const { q } = request.query as { q?: string };
      const results = await searchService.search(tenantId, q || "");
      reply.send({ results });
    },
  );
}
