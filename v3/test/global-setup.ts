import { config } from "dotenv";

config({ path: ".env.test" });

if (process.env.DATABASE_URL?.includes("/topaz_test") !== true) {
  throw new Error(
    "Refusing to run tests: DATABASE_URL does not point at the topaz_test database. " +
      "Check .env.test."
  );
}

const globalSetup = async () => {
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

  // Each worker thread imports src/server/db/client.ts, which opens its own
  // pooled postgres connection that vitest has no way to close on its own --
  // leaving the process hanging after the run. Global teardown closes it.
  return async () => {
    const { default: postgres } = await import("postgres");
    const conn = postgres(process.env.DATABASE_URL as string, { max: 1 });
    await conn.end({ timeout: 1 });
  };
};

export default globalSetup;
