import { z } from "zod";

export const baleWebhookSchema = z.object({
  update_id: z.union([z.string(), z.number()]),
  message: z.object({
    message_id: z.union([z.string(), z.number()]),
    text: z.string().max(512).optional(),
    from: z.object({ id: z.union([z.string(), z.number()]) }),
    chat: z.object({ id: z.union([z.string(), z.number()]) }),
  }).optional(),
  callback_query: z.object({
    id: z.union([z.string(), z.number()]),
    data: z.string().max(128).optional(),
    from: z.object({ id: z.union([z.string(), z.number()]) }),
    message: z.object({
      chat: z.object({ id: z.union([z.string(), z.number()]) }),
    }).optional(),
  }).optional(),
});

export type BaleWebhookUpdate = z.infer<typeof baleWebhookSchema>;
