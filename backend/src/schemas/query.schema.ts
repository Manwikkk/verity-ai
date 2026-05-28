import { z } from "zod";

export const querySchema = z.object({
  query: z.string().min(1, "Query cannot be empty").max(5000),
  providerId: z.string().optional(),
  chatId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(20).optional().default(8),
});

export type QueryInput = z.infer<typeof querySchema>;
