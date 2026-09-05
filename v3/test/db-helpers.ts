import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  session as sessionTable,
  user as userTable,
} from "@/server/db/schema/auth";

const SESSION_TTL_MS = 1000 * 60 * 60;

/**
 * Truncates every app table between tests, keeping the reference data
 * (taxonomy_kind, source_platform) global-setup seeds -- those are looked
 * up by slug in production code and are cheap to leave standing.
 */
export const truncateAppData = async () => {
  await db.execute(sql`
    truncate table
      "work_taxonomy_effective",
      "work_taxonomy_assignment",
      "taxonomy_relation",
      "taxonomy_term",
      "audit_log",
      "work_source_observation",
      "reading_event",
      "reading_state",
      "library_entry",
      "work_contributor",
      "work_source",
      "work",
      "contributor",
      "session",
      "account",
      "user"
    restart identity cascade
  `);
};

export const createTestUser = async (role: "admin" | "user" = "admin") => {
  const id = createId();
  const [row] = await db
    .insert(userTable)
    .values({
      email: `${id}@test.local`,
      emailVerified: true,
      id,
      name: `Test ${role}`,
      role,
    })
    .returning();
  return row;
};

/**
 * Inserts a real session row and returns Authorization-Bearer headers for
 * it -- the bearer plugin (enabled in src/lib/auth.ts) lets auth.api
 * .getSession() resolve a session by its raw token via the DB adapter
 * directly, without needing to replicate better-auth's signed-cookie
 * format outside a real OAuth login flow.
 */
export const createAuthHeaders = async (userId: string) => {
  const token = createId();
  await db.insert(sessionTable).values({
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    id: createId(),
    token,
    userId,
  });
  return new Headers({ authorization: `Bearer ${token}` });
};
