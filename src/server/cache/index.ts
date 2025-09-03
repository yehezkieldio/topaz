import Redis from "ioredis";
import { env } from "#/env";

let redis: Redis | null = null;
export let isCacheEnabled = Boolean(false);

const MAX_REDIS_FAILURES = 5;
let redisFailureCount = 0;

if (env.USE_REDIS_CACHING) {
    if (env.USE_UPSTASH && env.REDIS_URL) {
        redis = new Redis(env.REDIS_URL);
    } else if (env.REDIS_URL) {
        redis = new Redis(env.REDIS_URL);
    }

    if (redis) {
        isCacheEnabled = true;

        const disableCaching = (reason: string) => {
            if (!isCacheEnabled) return;
            console.warn(`[redis] ${reason} Caching disabled.`);
            isCacheEnabled = false;
            redis?.removeAllListeners();
            redis?.disconnect();
        };

        const handleFailure = (event: string, message?: string) => {
            if (!isCacheEnabled) return;

            redisFailureCount++;
            const logMessage = `[redis] ${event} (${redisFailureCount}/${MAX_REDIS_FAILURES})${message ? `: ${message}` : ""}`;
            event === "error" ? console.error(logMessage) : console.warn(logMessage);

            if (redisFailureCount >= MAX_REDIS_FAILURES) {
                disableCaching("Too many Redis connection issues.");
            }
        };

        redis.on("error", (err) => handleFailure("Redis connection error", err.message));
        redis.on("end", () => handleFailure("Redis connection ended"));

        redis.on("connect", () => {
            console.log("[redis] Connected to Redis.");
            redisFailureCount = 0;
        });

        redis.on("reconnecting", () => {
            if (isCacheEnabled) console.log("[redis] Reconnecting to Redis...");
        });
    } else {
        console.warn("[redis] Redis client not initialized. Check REDIS_URL or USE_REDIS_CACHING.");
    }
} else {
    console.log("[redis] Redis caching is disabled via environment variable (USE_REDIS_CACHING=false).");
}

export { redis };
