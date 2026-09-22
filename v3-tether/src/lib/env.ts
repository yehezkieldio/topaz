import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Absolute path to this device's SQLite file (08_sync/00_oplog_and_clock.md
  // -- one file per device, no shared connection string). No default: every
  // environment (dev, verify scripts, the compiled binary) states it
  // explicitly rather than silently writing into a fallback location.
  DATABASE_PATH: z.string().min(1),
  // Port this device's /api/sync endpoint is reachable on, for embedding in
  // the pairing code this device generates (08_sync/01_transport_and_pairing.md).
  // Auto-filled into .env once by scripts/sync-env-setup.ts (predev/prestart)
  // if missing, same as SYNC_TAILNET_HOSTNAME -- still an explicit value in
  // .env after that, not detected at runtime inside this process (this
  // schema parses process.env eagerly at import time, before any code here
  // could reach for `tailscale status`).
  SYNC_PORT: z.coerce.number().int().min(1).max(65_535),
  // This device's own Tailscale hostname (e.g. laptop-a.tailnet-name.ts.net),
  // embedded in the pairing code this device generates. Auto-filled into
  // .env once by scripts/sync-env-setup.ts from `tailscale status --json`'s
  // Self.DNSName if missing -- see that script for the fallback when
  // Tailscale isn't reachable.
  SYNC_TAILNET_HOSTNAME: z.string().min(1),
});

export const env = envSchema.parse(process.env);
