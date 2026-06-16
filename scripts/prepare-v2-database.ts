import postgres from "postgres";

const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required to prepare the V2 database");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
    await sql`CREATE EXTENSION IF NOT EXISTS citext`;
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log("Prepared V2 database extensions: citext, pg_trgm.");
} finally {
    await sql.end();
}
