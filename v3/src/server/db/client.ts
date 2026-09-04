import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

const conn = postgres(env.DATABASE_URL, { max: 1, prepare: false });

export const db = drizzle(conn, { casing: "snake_case", schema });
