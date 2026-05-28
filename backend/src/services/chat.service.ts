/**
 * Chat service: CRUD for chats and messages.
 */
import { prisma } from "../utils/prisma.js";
import { NotFoundError } from "../utils/errors.js";

export interface ChatDTO {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
  pinned: boolean;
}

export interface MessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; section: string; confidence: number }>;
  timestamp: string;
}

/** List chats for a tenant, sorted: pinned first, then by date. */
export async function listChats(tenantId: string, userId?: string): Promise<ChatDTO[]> {
  const chats = await prisma.chat.findMany({
    where: { tenantId, ...(userId ? { userId } : {}) },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return chats.map((c) => ({
    id: c.id,
    workspaceId: c.tenantId,
    title: c.title,
    createdAt: c.createdAt.getTime(),
    pinned: c.pinned,
  }));
}

/** Create a new chat. */
export async function createChat(
  tenantId: string,
  title: string,
  userId?: string,
): Promise<ChatDTO> {
  const chat = await prisma.chat.create({
    data: {
      tenantId,
      userId: userId ?? null,
      title: title.slice(0, 200),
    },
  });

  return {
    id: chat.id,
    workspaceId: chat.tenantId,
    title: chat.title,
    createdAt: chat.createdAt.getTime(),
    pinned: chat.pinned,
  };
}

/** Get a chat with all its messages. */
export async function getChat(
  tenantId: string,
  chatId: string,
): Promise<{ chat: ChatDTO; messages: MessageDTO[] }> {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, tenantId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!chat) throw new NotFoundError("Chat");

  return {
    chat: {
      id: chat.id,
      workspaceId: chat.tenantId,
      title: chat.title,
      createdAt: chat.createdAt.getTime(),
      pinned: chat.pinned,
    },
    messages: chat.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: m.sources as any,
      timestamp: m.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })),
  };
}

/** Update a chat (pin/unpin, rename). */
export async function updateChat(
  tenantId: string,
  chatId: string,
  data: { title?: string; pinned?: boolean },
): Promise<ChatDTO> {
  const existing = await prisma.chat.findFirst({ where: { id: chatId, tenantId } });
  if (!existing) throw new NotFoundError("Chat");

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.pinned !== undefined && { pinned: data.pinned }),
    },
  });

  return {
    id: updated.id,
    workspaceId: updated.tenantId,
    title: updated.title,
    createdAt: updated.createdAt.getTime(),
    pinned: updated.pinned,
  };
}

/** Delete a chat. */
export async function deleteChat(tenantId: string, chatId: string): Promise<void> {
  const existing = await prisma.chat.findFirst({ where: { id: chatId, tenantId } });
  if (!existing) throw new NotFoundError("Chat");

  await prisma.chat.delete({ where: { id: chatId } });
}

/** Add a message to a chat. */
export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  userId?: string,
  sources?: any,
  confidence?: number,
): Promise<MessageDTO> {
  const msg = await prisma.chatMessage.create({
    data: {
      chatId,
      role,
      content,
      userId: userId ?? null,
      sources: sources ?? null,
      confidence: confidence ?? null,
    },
  });

  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    sources: msg.sources as any,
    timestamp: msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}
