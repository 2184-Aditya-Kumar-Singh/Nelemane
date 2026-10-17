import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  topic: z.enum(["LIST_PG", "GENERAL", "SUPPORT"]),
  message: z.string().trim().min(10).max(3000),
});
