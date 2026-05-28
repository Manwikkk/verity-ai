import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../middleware/auth.middleware.js";
import { requireTenantPermission } from "../middleware/tenant.middleware.js";
import { createChatSchema, updateChatSchema } from "../schemas/chat.schema.js";
import * as chatService from "../services/chat.service.js";

export async function chatRoutes(app: FastifyInstance) {
  /** GET /tenant/:tenantId/chats */
  app.get(
    "/tenant/:tenantId/chats",
    { preHandler: [requireUser, requireTenantPermission("chat:read")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const chats = await chatService.listChats(tenantId, request.auth.sub);
      reply.send({ chats });
    },
  );

  /** POST /tenant/:tenantId/chats */
  app.post(
    "/tenant/:tenantId/chats",
    { preHandler: [requireUser, requireTenantPermission("chat:write")] },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = createChatSchema.parse(request.body);
      const chat = await chatService.createChat(tenantId, body.title, request.auth.sub);
      reply.status(201).send(chat);
    },
  );

  /** GET /tenant/:tenantId/chats/:chatId */
  app.get(
    "/tenant/:tenantId/chats/:chatId",
    { preHandler: [requireUser, requireTenantPermission("chat:read")] },
    async (request, reply) => {
      const { tenantId, chatId } = request.params as { tenantId: string; chatId: string };
      const result = await chatService.getChat(tenantId, chatId);
      reply.send(result);
    },
  );

  /** PATCH /tenant/:tenantId/chats/:chatId */
  app.patch(
    "/tenant/:tenantId/chats/:chatId",
    { preHandler: [requireUser, requireTenantPermission("chat:write")] },
    async (request, reply) => {
      const { tenantId, chatId } = request.params as { tenantId: string; chatId: string };
      const body = updateChatSchema.parse(request.body);
      const chat = await chatService.updateChat(tenantId, chatId, body);
      reply.send(chat);
    },
  );

  /** DELETE /tenant/:tenantId/chats/:chatId */
  app.delete(
    "/tenant/:tenantId/chats/:chatId",
    { preHandler: [requireUser, requireTenantPermission("chat:delete")] },
    async (request, reply) => {
      const { tenantId, chatId } = request.params as { tenantId: string; chatId: string };
      await chatService.deleteChat(tenantId, chatId);
      reply.status(204).send();
    },
  );
}
