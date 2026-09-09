import { config } from "dotenv";

config({ path: ".env.test" });

if (process.env.DATABASE_URL?.includes("/topaz_test") !== true) {
  throw new Error(
    "Refusing to run e2e tests: DATABASE_URL does not point at the " +
      "topaz_test database. Check .env.test."
  );
}

/**
 * Mints a real admin session in the test DB and writes its bearer token to
 * a scratch file for library-flow.spec.ts to read -- never printed to
 * stdout/logs. The `bearer` plugin (src/lib/auth.ts) lets requireAdmin()
 * resolve this via an Authorization header, so the browser context never
 * needs a real Discord OAuth round trip or a hand-rolled signed cookie.
 */
const globalSetup = async () => {
  const { truncateAppData, createTestUser, createAuthHeaders } =
    await import("../test/db-helpers");
  const { writeFile } = await import("node:fs/promises");

  await truncateAppData();

  const { taxonomyKind, sourcePlatform } =
    await import("../src/server/db/schema");
  const { db } = await import("../src/server/db/client");
  await db
    .insert(taxonomyKind)
    .values([{ name: "Fandom", slug: "fandom" }])
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

  const admin = await createTestUser("admin");
  const headers = await createAuthHeaders(admin.id);
  const token = headers.get("authorization")?.replace("Bearer ", "") ?? "";

  await writeFile("e2e/.bearer-token", token, { mode: 0o600 });
};

export default globalSetup;
