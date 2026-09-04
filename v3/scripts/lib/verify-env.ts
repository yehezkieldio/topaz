import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ override: true, path: ".env.test" });

if (process.env.DATABASE_URL?.includes("/topaz_test") !== true) {
  throw new Error(
    "Refusing to run against a non-test database. Check .env.test -- " +
      "verify scripts truncate app tables and must never point at dev/prod data."
  );
}

export const log = {
  fail: (message: string) => {
    process.stdout.write(`  \u001B[31mFAIL\u001B[0m ${message}\n`);
  },
  pass: (message: string) => {
    process.stdout.write(`  \u001B[32mPASS\u001B[0m ${message}\n`);
  },
  section: (title: string) => {
    process.stdout.write(`\n${title}\n`);
  },
};

let failures = 0;

export const check = async (
  description: string,
  assertion: () => Promise<boolean> | boolean
) => {
  const ok = await assertion();
  if (ok) {
    log.pass(description);
  } else {
    log.fail(description);
    failures += 1;
  }
};

export const reportAndExit = () => {
  process.stdout.write(
    failures === 0
      ? "\nAll verification checks passed.\n"
      : `\n${failures} verification check(s) failed.\n`
  );
  process.exitCode = failures === 0 ? 0 : 1;
};

export const closeDb = async () => {
  const { closeDbConnection } = await import("@/server/db/client");
  await closeDbConnection();
};

export const truncateAppData = async () => {
  const { db } = await import("@/server/db/client");
  await db.execute(sql`
    truncate table
      "work_taxonomy_effective",
      "work_taxonomy_assignment",
      "taxonomy_relation",
      "taxonomy_term",
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

export const seedReferenceData = async () => {
  const { db } = await import("@/server/db/client");
  const { sourcePlatform, taxonomyKind } = await import("@/server/db/schema");

  await db
    .insert(taxonomyKind)
    .values([
      { name: "Fandom", slug: "fandom" },
      { name: "Custom", slug: "custom" },
    ])
    .onConflictDoNothing();

  await db
    .insert(sourcePlatform)
    .values([
      {
        baseUrl: "https://archiveofourown.org",
        name: "Archive of Our Own",
        slug: "ao3",
      },
    ])
    .onConflictDoNothing();
};

export const createTestUser = async (role: "admin" | "user") => {
  const { db } = await import("@/server/db/client");
  const { user: userTable } = await import("@/server/db/schema/auth");
  const id = createId();
  const [row] = await db
    .insert(userTable)
    .values({
      email: `${id}@verify.local`,
      emailVerified: true,
      id,
      name: `Verify ${role}`,
      role,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert verify-script test user.");
  }

  return row;
};

const SESSION_TTL_MS = 1000 * 60 * 60;

export const createAuthHeaders = async (userId: string) => {
  const { db } = await import("@/server/db/client");
  const { session: sessionTable } = await import("@/server/db/schema/auth");
  const token = createId();
  await db.insert(sessionTable).values({
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    id: createId(),
    token,
    userId,
  });
  return new Headers({ authorization: `Bearer ${token}` });
};

export const noSessionHeaders = () => new Headers();
