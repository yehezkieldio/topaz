import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const isDevelopment = process.env.NODE_ENV === "development";

function devUse<T>(value: T, fallback: T): T {
    return isDevelopment ? value : fallback;
}

export const env = createEnv({
    client: {
        NEXT_PUBLIC_VERSION: z.string().default("1.0.0"),
    },
    emptyStringAsUndefined: true,
    runtimeEnv: {
        ALLOWED_DISCORD_ID: process.env.ALLOWED_DISCORD_ID,
        AUTH_DISCORD_ID: devUse(process.env.DEVELOPMENT_AUTH_DISCORD_ID, process.env.AUTH_DISCORD_ID),
        AUTH_DISCORD_SECRET: devUse(process.env.DEVELOPMENT_AUTH_DISCORD_SECRET, process.env.AUTH_DISCORD_SECRET),
        AUTH_SECRET: process.env.AUTH_SECRET,

        DATABASE_URL: devUse(process.env.DEVELOPMENT_DATABASE_URL, process.env.DATABASE_URL),

        NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
        NODE_ENV: process.env.NODE_ENV,

        USE_REACTQUERY_DEVTOOLS: process.env.USE_REACTQUERY_DEVTOOLS,
    },
    server: {
        ALLOWED_DISCORD_ID: z.string(),
        AUTH_DISCORD_ID: z.string(),
        AUTH_DISCORD_SECRET: z.string(),
        AUTH_SECRET: z.string(),

        DATABASE_URL: z.url(),
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

        USE_REACTQUERY_DEVTOOLS: z.coerce.boolean().default(false),
    },
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
