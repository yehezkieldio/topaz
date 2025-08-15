import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isDevelopment = process.env.NODE_ENV === "development";

function devUse<T>(value: T, fallback: T): T {
    return isDevelopment ? value : fallback;
}

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        AUTH_SECRET: z.string(),
        ALLOWED_DISCORD_ID: z.string(),

        USE_REDIS_CACHING: z.coerce.boolean().default(false),
        USE_UPSTASH: z.coerce.boolean().default(false),
        USE_REACTQUERY_DEVTOOLS: z.coerce.boolean().default(false),

        DATABASE_URL: z.url(),
        AUTH_DISCORD_ID: z.string(),
        AUTH_DISCORD_SECRET: z.string(),
        REDIS_URL: z.url().optional(),
    },
    client: {
        NEXT_PUBLIC_VERSION: z.string().default("1.0.0"),
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        AUTH_SECRET: process.env.AUTH_SECRET,
        ALLOWED_DISCORD_ID: process.env.ALLOWED_DISCORD_ID,

        USE_REDIS_CACHING: process.env.USE_REDIS_CACHING,
        USE_UPSTASH: process.env.USE_UPSTASH,
        USE_REACTQUERY_DEVTOOLS: process.env.USE_REACTQUERY_DEVTOOLS,

        DATABASE_URL: devUse(process.env.DEVELOPMENT_DATABASE_URL, process.env.DATABASE_URL),
        AUTH_DISCORD_ID: devUse(process.env.DEVELOPMENT_AUTH_DISCORD_ID, process.env.AUTH_DISCORD_ID),
        AUTH_DISCORD_SECRET: devUse(process.env.DEVELOPMENT_AUTH_DISCORD_SECRET, process.env.AUTH_DISCORD_SECRET),
        REDIS_URL:
            process.env.USE_UPSTASH === "true"
                ? process.env.REDIS_URL
                : devUse(process.env.DEVELOPMENT_REDIS_URL, process.env.REDIS_URL),

        NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
    },
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined: true,
});
