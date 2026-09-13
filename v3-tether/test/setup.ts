import { afterAll, vi } from "vitest";

import { closeDbConnection } from "@/server/db/client";

/**
 * `next/headers` and `next/cache` are redirected to test/stubs/next-headers.ts
 * and test/stubs/next-cache.ts via vitest.config.ts's resolve.alias (the same
 * mechanism used for the "server-only" stub) rather than vi.mock() -- that
 * redirect happens at module-resolution time, before any module graph is
 * evaluated, so there's no module-registry interception and no import-order
 * race with a transitive real `next/headers` import getting cached first.
 * Both stubs read/write these exports, so this module must still be
 * evaluated before them -- guaranteed by its listing in `setupFiles`, which
 * Vitest runs to completion before any test file's own module graph.
 */
export const headersRef = { current: new Headers() };
export const revalidateTagMock = vi.fn();

afterAll(async () => {
  await closeDbConnection();
});
