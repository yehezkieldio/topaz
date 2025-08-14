import Redis from "ioredis";
import { env } from "#/env";

let redis: Redis | null = null;
export let isCacheEnabled = false;

if (env.USE_REDIS_CACHING) {
    if (env.USE_UPSTASH) {
        if (env.REDIS_URL) {
            redis = new Redis(env.REDIS_URL);
        }
    } else if (env.REDIS_URL) {
        redis = new Redis(env.REDIS_URL);
    }

    if (redis) {
        isCacheEnabled = true;

        redis.on("error", (err) => {
            console.error("[redis] Redis connection error: Caching disabled.", err.message);
            isCacheEnabled = false;
        });

        redis.on("end", () => {
            console.warn("[redis] Redis connection ended: Caching disabled.");
            isCacheEnabled = false;
        });

        redis.on("connect", () => {
            console.log("[redis] Connected to Redis.");
        });

        redis.on("reconnecting", () => {
            console.log("[redis] Reconnecting to Redis...");
        });
    } else {
        console.warn(
            "[redis] Redis client not initialized. Check REDIS_URL or USE_REDIS_CACHING environment variables.",
        );
    }
} else {
    console.log("[redis] Redis caching is disabled via environment variable (USE_REDIS_CACHING=false).");
}

export { redis };
