import { z } from "zod";

export const createChatSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(10000),
  providerId: z.string().optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type UpdateChatInput = z.infer<typeof updateChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
