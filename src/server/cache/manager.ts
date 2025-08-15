import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress } from "node:zlib";
import { isCacheEnabled, redis } from "#/server/cache";

const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);

export type CacheConfig = {
    ttl?: number;
    compress?: boolean;
    jitter?: boolean;
    staleWhileRevalidate?: number;
    version?: string;
    probabilisticExpiration?: number;
    scanBatchSize?: number;
    snapshot?: boolean;
};

const SECONDS_IN_MINUTE: number = 60;
const DEFAULT_TTL_MINUTES: number = 5;
const DEFAULT_TTL: number = SECONDS_IN_MINUTE * DEFAULT_TTL_MINUTES;

const BYTES_IN_KB: number = 1024;
const KB_IN_MB: number = 1024;
const BYTES_IN_MB: number = BYTES_IN_KB * KB_IN_MB;
const MAX_CACHE_SIZE_MB: number = 1;
const MAX_CACHE_SIZE: number = BYTES_IN_MB * MAX_CACHE_SIZE_MB;

const JITTER_FACTOR: number = 0.1;
const EARLY_EXPIRATION_MIN_FACTOR: number = 0.7;
const COMPRESSION_THRESHOLD: number = 512;
const MAX_KEY_LENGTH: number = 150;
const EARLY_EXPIRATION_RANGE: number = 0.25;
const COMPRESSION_RATIO_THRESHOLD: number = 0.8;
const ONE_HOUR_IN_SECONDS: number = 3600;
const CURSOR_SLICE_LENGTH: number = 50;
const MIN_ENTROPY_FOR_COMPRESSION = 0.6;
const HASH_SLICE_LENGTH: number = 12;
const DEFAULT_SCAN_BATCH_SIZE: number = 500;
const DEFAULT_PROBABILISTIC_EXPIRATION: number = 0.01; // 1% of keys expire early
const VERSION: string = "v1";

const pendingRequests = new Map<string, Promise<unknown>>();
const keyCache = new Map<string, string>(); // Cache computed keys

function sanitizeKeyComponent(input: string): string {
    return input.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, MAX_KEY_LENGTH);
}

function buildKey(prefix: string, key: string, version = VERSION): string {
    const cacheKey = `${prefix}:${key}:${version}`;
    const cached = keyCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const sanitizedKey = `${prefix}:${version}:${key}`;
    keyCache.set(cacheKey, sanitizedKey);
    return sanitizedKey;
}

function calculateEntropy(text: string): number {
    const charCounts = new Map<string, number>();
    for (const char of text) {
        charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = text.length;
    for (const count of charCounts.values()) {
        const probability = count / length;
        entropy -= probability * Math.log2(probability);
    }

    return entropy / Math.log2(charCounts.size || 1); // Normalized entropy
}

function shouldCompress(payload: string): boolean {
    if (payload.length <= COMPRESSION_THRESHOLD) return false;
    return calculateEntropy(payload) >= MIN_ENTROPY_FOR_COMPRESSION;
}

function serializeValue<T>(value: T): string {
    if (typeof value === "string") return value;
    if (Buffer.isBuffer(value)) return value.toString("base64");
    return JSON.stringify(value);
}

async function deserializeValue<T>(payload: string, isCompressed: boolean): Promise<T> {
    let data = payload;

    if (isCompressed) {
        const compressedData = Buffer.from(payload.slice(2), "base64");
        const decompressed = await decompress(compressedData);
        data = decompressed.toString("utf8");
    }

    // Try JSON parse first, fallback to raw string
    try {
        return JSON.parse(data) as T;
    } catch {
        return data as unknown as T;
    }
}

function addTTLJitter(ttl: number): number {
    const jitter = Math.floor(Math.random() * (ttl * JITTER_FACTOR));
    return ttl + jitter;
}

function applyProbabilisticExpiration(ttl: number, probabilisticRate: number): number {
    if (Math.random() < probabilisticRate) {
        const earlyFactor = EARLY_EXPIRATION_MIN_FACTOR + Math.random() * EARLY_EXPIRATION_RANGE;
        return Math.floor(ttl * earlyFactor);
    }
    return ttl;
}

export const CacheManager = {
    async get<T>(prefix: string, key: string, config: CacheConfig = {}): Promise<T | null> {
        if (!isCacheEnabled || redis === null) {
            return null;
        }

        try {
            const cacheKey = buildKey(prefix, key, config.version);
            const cached = await redis.get(cacheKey);
            if (cached === null) {
                console.log(`[cache] MISS: ${key}`);
                return null;
            }

            console.log(`[cache] HIT: ${key}`);

            const isCompressed = cached.startsWith("c:");
            return await deserializeValue<T>(cached, isCompressed);
        } catch (error) {
            console.warn("[cache] Cache read error:", error);
            return null;
        }
    },

    async getMultiple<T>(prefix: string, keys: string[], config: CacheConfig = {}): Promise<Map<string, T | null>> {
        const result = new Map<string, T | null>();

        if (!isCacheEnabled || redis === null || keys.length === 0) {
            for (const key of keys) {
                result.set(key, null);
            }
            return result;
        }

        try {
            const cacheKeys = keys.map((key) => buildKey(prefix, key, config.version));
            const cached = await redis.mget(...cacheKeys);

            const deserializationPromises = keys.map(async (originalKey, i) => {
                const cacheKey = cacheKeys[i];
                const cachedValue = cached[i];

                if (cachedValue === null) {
                    console.log(`[cache] MISS: ${cacheKey}`);
                    return [originalKey, null] as const;
                }

                console.log(`[cache] HIT: ${cacheKey}`);

                const isCompressed = cachedValue.startsWith("c:");
                const value = await deserializeValue<T>(cachedValue, isCompressed);
                return [originalKey, value] as const;
            });

            const deserializedResults = await Promise.all(deserializationPromises);

            for (const [originalKey, value] of deserializedResults) {
                result.set(originalKey, value);
            }
        } catch (error) {
            console.warn("[cache] Multiple read error:", error);
            for (const key of keys) {
                result.set(key, null);
            }
        }

        return result;
    },

    async set<T>(prefix: string, key: string, value: T, config: CacheConfig = {}): Promise<void> {
        if (!isCacheEnabled || redis === null) {
            return;
        }

        try {
            const cacheKey = buildKey(prefix, key, config.version);
            let ttl = config.ttl ?? DEFAULT_TTL;

            if (config.jitter) {
                ttl = addTTLJitter(ttl);
            }

            const probabilisticRate = config.probabilisticExpiration ?? DEFAULT_PROBABILISTIC_EXPIRATION;
            ttl = applyProbabilisticExpiration(ttl, probabilisticRate);

            let payload = serializeValue(value);

            if (payload.length > MAX_CACHE_SIZE) {
                console.warn(`[cache] SKIP: Payload too large (${payload.length} bytes)`);
                return;
            }

            if (config.compress && shouldCompress(payload)) {
                const compressed = await compress(Buffer.from(payload, "utf8"));
                const compressedPayload = `c:${compressed.toString("base64")}`;

                if (compressedPayload.length < payload.length * COMPRESSION_RATIO_THRESHOLD) {
                    payload = compressedPayload;
                }
            }

            await redis.setex(cacheKey, ttl, payload);
            console.log(`[cache] SET: ${cacheKey} (${payload.length}b, ttl=${ttl})`);

            if (config.staleWhileRevalidate) {
                const staleKey = `${cacheKey}:stale`;
                const staleTTL = ttl + config.staleWhileRevalidate;
                setImmediate(async () => {
                    try {
                        if (redis) {
                            await redis.setex(staleKey, staleTTL, payload);
                        }
                    } catch (error) {
                        console.warn("[cache] Stale cache write error:", error);
                    }
                });
            }
        } catch (error) {
            console.warn("[cache] Write error:", error);
        }
    },

    async getWithSingleflight<T>(
        prefix: string,
        key: string,
        factory: () => Promise<T>,
        config: CacheConfig = {},
        tags: string[] = [],
    ): Promise<T> {
        const cacheKey = buildKey(prefix, key, config.version);

        const pendingKey = `${cacheKey}`;
        if (pendingRequests.has(pendingKey)) {
            return pendingRequests.get(pendingKey) as Promise<T>;
        }

        const cached = await this.get<T>(prefix, key, config);
        if (cached !== null) {
            return cached;
        }

        if (config.staleWhileRevalidate) {
            const staleKey = `${cacheKey}:stale`;
            try {
                if (redis) {
                    const stale = await redis.get(staleKey);
                    if (stale) {
                        setImmediate(async () => {
                            try {
                                const fresh = await factory();
                                await this.setWithTags(prefix, key, fresh, tags, config);
                            } catch (error) {
                                console.warn("[cache] Background refresh error:", error);
                            }
                        });

                        const isCompressed = stale.startsWith("c:");
                        return await deserializeValue<T>(stale, isCompressed);
                    }
                }
            } catch (error) {
                console.warn("[cache] Stale cache error:", error);
            }
        }

        const promise = (async () => {
            try {
                const result = await factory();
                await this.setWithTags(prefix, key, result, tags, config);
                return result;
            } catch (error) {
                pendingRequests.delete(pendingKey);
                throw error;
            } finally {
                pendingRequests.delete(pendingKey);
            }
        })();

        pendingRequests.set(pendingKey, promise);
        return promise;
    },

    async invalidate(prefix: string, pattern?: string, config: CacheConfig = {}): Promise<void> {
        if (!isCacheEnabled || redis === null) {
            return;
        }

        try {
            const searchPattern = pattern ? `${prefix}:${VERSION}:${pattern}*` : `${prefix}:${VERSION}:*`;
            const scanBatchSize = config.scanBatchSize ?? DEFAULT_SCAN_BATCH_SIZE;

            let cursor = "0";
            const keysToDelete: string[] = [];
            do {
                const [nextCursor, keys] = await redis.scan(cursor, "MATCH", searchPattern, "COUNT", scanBatchSize);
                cursor = nextCursor;
                if (keys?.length) {
                    keysToDelete.push(...keys);
                    const staleKeys = keys.map((k) => `${k}:stale`);
                    keysToDelete.push(...staleKeys);
                }
            } while (cursor !== "0");

            if (keysToDelete.length > 0) {
                const pipeline = redis.pipeline();
                for (const k of keysToDelete) pipeline.unlink(k);
                await pipeline.exec();
                console.log(`[cache] INVALIDATE: ${keysToDelete.length} keys for pattern ${searchPattern}`);
            }
        } catch (error) {
            console.warn("[cache] Invalidation error:", error);
        }
    },

    async invalidateByTags(tags: string[], config: CacheConfig = {}): Promise<void> {
        if (!isCacheEnabled || redis === null || tags.length === 0) {
            return;
        }

        try {
            const pipeline = redis.pipeline();

            for (const tag of tags) {
                const tagKey = `tags:${VERSION}:${tag}`;
                pipeline.smembers(tagKey);
                pipeline.ttl(tagKey);
            }

            const results = await pipeline.exec();
            const keysToDelete = new Set<string>();
            const tagKeys: string[] = [];

            for (let i = 0; i < tags.length; i++) {
                const membersResult = results?.[i * 2];
                const ttlResult = results?.[i * 2 + 1];

                if (membersResult && Array.isArray(membersResult[1])) {
                    const members = membersResult[1] as string[];
                    for (const key of members) {
                        keysToDelete.add(key);
                        keysToDelete.add(`${key}:stale`);
                    }
                }

                // Only delete tag sets that have reasonable TTL left
                // If TTL is very long or -1 (no expiry), we should clean it up
                const tagTTL = ttlResult?.[1] as number;
                if (tagTTL === -1 || tagTTL > (config.ttl ?? DEFAULT_TTL) * 2) {
                    const tagKey = `tags:${VERSION}:${tags[i]}`;
                    tagKeys.push(tagKey);
                }
            }

            if (keysToDelete.size > 0 || tagKeys.length > 0) {
                const deletePipeline = redis.pipeline();
                for (const key of keysToDelete) {
                    deletePipeline.unlink(key);
                }
                for (const tagKey of tagKeys) {
                    deletePipeline.unlink(tagKey);
                }
                await deletePipeline.exec();
                console.log(
                    `[cache] INVALIDATE BY TAGS: ${tags.join(", ")} (${keysToDelete.size} keys, ${tagKeys.length} tag sets)`,
                );
            }
        } catch (error) {
            console.warn("[cache] Tag-based invalidation error:", error);
        }
    },

    async setWithTags<T>(
        prefix: string,
        key: string,
        value: T,
        tags: string[],
        config: CacheConfig = {},
    ): Promise<void> {
        await this.set(prefix, key, value, config);

        if (!isCacheEnabled || redis === null || tags.length === 0) {
            return;
        }

        try {
            const cacheKey = buildKey(prefix, key, config.version);
            const keyTTL = config.ttl ?? DEFAULT_TTL;
            const desiredTagTTL = keyTTL + ONE_HOUR_IN_SECONDS;

            // Single pipeline for both SADD and EXPIRE operations
            const pipeline = redis.pipeline();

            for (const tag of tags) {
                const tagKey = `tags:${VERSION}:${tag}`;
                pipeline.sadd(tagKey, cacheKey);
                pipeline.expire(tagKey, desiredTagTTL);
            }

            await pipeline.exec();
            console.log(`[cache] SET WITH TAGS: ${tags.join(", ")}`);
        } catch (error) {
            console.warn("[cache] Tag association error:", error);
        }
    },

    async invalidateMultiple(patterns: string[], config: CacheConfig = {}): Promise<void> {
        if (!isCacheEnabled || redis === null) {
            return;
        }

        try {
            const keysToDelete: string[] = [];
            const scanBatchSize = config.scanBatchSize ?? DEFAULT_SCAN_BATCH_SIZE;

            for (const pattern of patterns) {
                const searchPattern = `${pattern}:${VERSION}:*`;
                let cursor = "0";
                do {
                    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", searchPattern, "COUNT", scanBatchSize);
                    cursor = nextCursor;
                    if (keys?.length) {
                        keysToDelete.push(...keys);
                        const staleKeys = keys.map((k) => `${k}:stale`);
                        keysToDelete.push(...staleKeys);
                    }
                } while (cursor !== "0");
            }

            if (keysToDelete.length > 0) {
                const pipeline = redis.pipeline();
                for (const k of keysToDelete) pipeline.unlink(k);
                await pipeline.exec();
                console.log(`[cache] INVALIDATE MULTIPLE: ${patterns.join(", ")}`);
            }
        } catch (error) {
            console.warn("[cache] Cache multiple invalidation error:", error);
        }
    },

    async invalidateView(): Promise<void> {
        await this.invalidateByTags(["view", "progress"]);
        await this.invalidateByTags(["view", "stats"]);
    },

    async invalidateStory(storyId?: string): Promise<void> {
        console.log("[cache] Invalidating story cache");
        const tags = ["story", "progress", "view"];
        if (storyId) {
            tags.push(`story:${storyId}`);
        }
        await this.invalidateByTags(tags);
    },

    async invalidateTag(tagId?: string): Promise<void> {
        console.log("[cache] Invalidating tag cache");
        const tags = ["tag", "progress", "view"];
        if (tagId) {
            tags.push(`tag:${tagId}`);
        }
        await this.invalidateByTags(tags);
    },

    async invalidateFandom(fandomId?: string): Promise<void> {
        console.log("[cache] Invalidating fandom cache");
        const tags = ["fandom", "progress", "view"];
        if (fandomId) {
            tags.push(`fandom:${fandomId}`);
        }
        await this.invalidateByTags(tags);
    },
};

export const CacheKeys = {
    story: {
        byId: (id: string) => `story:${sanitizeKeyComponent(id)}`,
        forDropdown: (search: string, limit: number) => `dropdown:${sanitizeKeyComponent(search)}:${limit}`,
        forMultiselect: (search: string | null, limit: number, includeHot: boolean, hotLimit: number) =>
            `multiselect:${sanitizeKeyComponent(search || "")}:${limit}:${includeHot}:${hotLimit}`,
        hot: (limit: number) => `hot:${limit}`,
    },
    fandom: {
        byId: (id: string) => `fandom:${sanitizeKeyComponent(id)}`,
        forDropdown: (search: string, limit: number) => `dropdown:${sanitizeKeyComponent(search)}:${limit}`,
        forMultiselect: (search: string | null, limit: number, includeHot: boolean, hotLimit: number) =>
            `multiselect:${sanitizeKeyComponent(search || "")}:${limit}:${includeHot}:${hotLimit}`,
        hot: (limit: number) => `hot:${limit}`,
    },
    tag: {
        byId: (id: string) => `tag:${sanitizeKeyComponent(id)}`,
        forDropdown: (search: string, limit: number) => `dropdown:${sanitizeKeyComponent(search)}:${limit}`,
        forMultiselect: (search: string | null, limit: number, includeHot: boolean, hotLimit: number) =>
            `multiselect:${sanitizeKeyComponent(search || "")}:${limit}:${includeHot}:${hotLimit}`,
        hot: (limit: number) => `hot:${limit}`,
    },
    progress: {
        all: (search: string, status: string, sortBy: string, sortOrder: string, cursor: string) => {
            const params = {
                s: search || "",
                st: status || "[]",
                sb: sortBy,
                so: sortOrder,
                c: cursor.slice(0, CURSOR_SLICE_LENGTH),
            };

            const hash = createHash("md5").update(JSON.stringify(params)).digest("hex").slice(0, HASH_SLICE_LENGTH);
            return `all:${hash}`;
        },
        byUser: (userId: string) => `u:${sanitizeKeyComponent(userId)}`,
    },
    view: {
        refresh: () => "refresh",
    },
} as const;
