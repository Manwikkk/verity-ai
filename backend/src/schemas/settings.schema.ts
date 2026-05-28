import { z } from "zod";

export const updateProviderSchema = z.object({
  apiKey: z.string().min(1, "API key cannot be empty").optional(),
  model: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
