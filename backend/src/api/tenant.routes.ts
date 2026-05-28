import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../middleware/auth.middleware.js";
import * as tenantService from "../services/tenant.service.js";
import { z } from "zod";

export async function tenantRoutes(app: FastifyInstance) {
  /** GET /tenants — List user's tenants */
  app.get("/tenants", { preHandler: [requireAuth] }, async (request, reply) => {
    const tenants = request.auth.isGuest
      ? await tenantService.getUserTenants(request.auth.tenants.map((t) => t.id))
      : await tenantService.getUserTenantsByUserId(request.auth.sub);
    reply.send({ tenants });
  });

  /** GET /tenant/:tenantId — Get tenant details */
  app.get("/tenant/:tenantId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await tenantService.getTenant(tenantId);
    reply.send(tenant);
  });

  /** POST /tenant — Create a new tenant (admin only) */
  app.post("/tenant", { preHandler: [requireUser] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      tag: z.string().min(1).max(8),
      env: z.string().default("prod"),
    });
    const body = schema.parse(request.body);
    const tenant = await tenantService.createTenant(
      body.name,
      body.tag,
      body.env,
      request.auth.sub,
    );
    reply.status(201).send(tenant);
  });

  /** DELETE /tenant/:tenantId — Delete a workspace */
  app.delete("/tenant/:tenantId", { preHandler: [requireUser] }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    await tenantService.deleteTenant(tenantId, request.auth.sub);
    reply.status(204).send();
  });
}
