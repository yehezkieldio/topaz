import { z } from "zod";

import { defaultDatabasePath } from "./default-database-path";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Absolute path to this device's SQLite file (08_sync/00_oplog_and_clock.md
  // -- one file per device, no shared connection string). Optional here,
  // not required, only in production (see resolveDatabasePath below) -- dev
  // and test keep the original "every environment states it explicitly"
  // behavior (predev's sync-env-setup.ts deliberately never auto-fills this
  // one, and scripts/lib/verify-env.ts's topaz_test guard depends on it
  // being an explicit, inspectable value there). The platform-conventional
  // default only exists for the compiled binary an end user runs, where
  // requiring them to hand-set an absolute path first is the wrong
  // ergonomics.
  DATABASE_PATH: z.string().min(1).optional(),
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

const parsedEnv = envSchema.parse(process.env);

/**
 * DATABASE_PATH resolution: an explicit value always wins, in every
 * environment. Only when it's unset does NODE_ENV decide what happens --
 * production (the compiled binary) falls back to the platform data
 * directory so a first run doesn't require the admin to hand-set a path
 * before the app can even start; dev/test throw the same explicit,
 * immediate error parsing DATABASE_PATH itself used to give, since silently
 * defaulting there would mask a broken .env instead of surfacing it (and
 * would risk a dev run and a "production" run resolving to two different
 * on-disk files without anyone noticing).
 */
const resolveDatabasePath = (): string => {
  if (parsedEnv.DATABASE_PATH) {
    return parsedEnv.DATABASE_PATH;
  }
  if (process.env.NODE_ENV === "production") {
    return defaultDatabasePath;
  }
  throw new Error(
    "DATABASE_PATH is required outside production -- set it explicitly in .env for dev/test."
  );
};

export const env = { ...parsedEnv, DATABASE_PATH: resolveDatabasePath() };
