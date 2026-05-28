import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../middleware/auth.middleware.js";
import { requireTenantPermission } from "../middleware/tenant.middleware.js";
import { updateProviderSchema } from "../schemas/settings.schema.js";
import * as settingsService from "../services/settings.service.js";

export async function settingsRoutes(app: FastifyInstance) {
  /** GET /tenant/:tenantId/settings/providers */
  app.get(
    "/tenant/:tenantId/settings/providers",
    { preHandler: [requireAuth, requireTenantPermission("settings:read")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const providers = await settingsService.listProviders(tenantId);
      reply.send({ providers });
    },
  );

  /** PUT /tenant/:tenantId/settings/providers/:providerId */
  app.put(
    "/tenant/:tenantId/settings/providers/:providerId",
    { preHandler: [requireUser, requireTenantPermission("settings:write")] },
    async (request, reply) => {
      const { tenantId, providerId } = request.params as { tenantId: string; providerId: string };
      const body = updateProviderSchema.parse(request.body);
      const provider = await settingsService.updateProvider(
        tenantId,
        providerId,
        body,
        request.auth.sub,
      );
      reply.send(provider);
    },
  );

  /** DELETE /tenant/:tenantId/settings/providers/:providerId */
  app.delete(
    "/tenant/:tenantId/settings/providers/:providerId",
    { preHandler: [requireUser, requireTenantPermission("settings:write")] },
    async (request, reply) => {
      const { tenantId, providerId } = request.params as { tenantId: string; providerId: string };
      await settingsService.removeProviderKey(tenantId, providerId, request.auth.sub);
      reply.status(204).send();
    },
  );
}
