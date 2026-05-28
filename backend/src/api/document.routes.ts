import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTenantPermission } from "../middleware/tenant.middleware.js";
import * as docService from "../services/document.service.js";

export async function documentRoutes(app: FastifyInstance) {
  /** GET /tenant/:tenantId/documents */
  app.get(
    "/tenant/:tenantId/documents",
    { preHandler: [requireAuth, requireTenantPermission("document:read")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const documents = await docService.listDocuments(tenantId);
      reply.send({ documents });
    },
  );

  /** GET /tenant/:tenantId/documents/:docId */
  app.get(
    "/tenant/:tenantId/documents/:docId",
    { preHandler: [requireAuth, requireTenantPermission("document:read")] },
    async (request, reply) => {
      const { tenantId, docId } = request.params as { tenantId: string; docId: string };
      const doc = await docService.getDocument(tenantId, docId);
      reply.send(doc);
    },
  );

  /** GET /tenant/:tenantId/documents/:docId/status */
  app.get(
    "/tenant/:tenantId/documents/:docId/status",
    { preHandler: [requireAuth, requireTenantPermission("document:read")] },
    async (request, reply) => {
      const { tenantId, docId } = request.params as { tenantId: string; docId: string };
      const status = await docService.getDocumentStatus(tenantId, docId);
      reply.send(status);
    },
  );

  /** GET /tenant/:tenantId/documents/:docId/download */
  app.get(
    "/tenant/:tenantId/documents/:docId/download",
    { preHandler: [requireAuth, requireTenantPermission("document:read")] },
    async (request, reply) => {
      const { tenantId, docId } = request.params as { tenantId: string; docId: string };
      const file = await docService.downloadDocument(tenantId, docId);
      reply
        .header("Content-Type", file.mimeType)
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`)
        .send(file.buffer);
    },
  );

  /** POST /tenant/:tenantId/documents — Upload document (multipart) */
  app.post(
    "/tenant/:tenantId/documents",
    { preHandler: [requireAuth, requireTenantPermission("document:upload")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };

      const data = await request.file();
      if (!data) {
        reply.status(400).send({ error: "No file uploaded" });
        return;
      }

      const buffer = await data.toBuffer();
      const doc = await docService.uploadDocument(
        tenantId,
        data.filename,
        data.mimetype,
        buffer,
        request.auth.name || "Unknown",
        request.auth.isGuest ? undefined : request.auth.sub,
      );

      reply.status(201).send(doc);
    },
  );

  /** DELETE /tenant/:tenantId/documents/:docId */
  app.delete(
    "/tenant/:tenantId/documents/:docId",
    { preHandler: [requireAuth, requireTenantPermission("document:delete")] },
    async (request, reply) => {
      const { tenantId, docId } = request.params as { tenantId: string; docId: string };
      await docService.deleteDocument(
        tenantId,
        docId,
        request.auth.isGuest ? undefined : request.auth.sub,
      );
      reply.status(204).send();
    },
  );
}
