import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Absolute path to this device's SQLite file (08_sync/00_oplog_and_clock.md
  // -- one file per device, no shared connection string). No default: every
  // environment (dev, verify scripts, the compiled binary) states it
  // explicitly rather than silently writing into a fallback location.
  DATABASE_PATH: z.string().min(1),
});

export const env = envSchema.parse(process.env);
