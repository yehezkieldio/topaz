import { z } from "zod";

const envSchema = z.object({
  ADMIN_DISCORD_ID: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.url(),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
