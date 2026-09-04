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
};

export default globalSetup;
