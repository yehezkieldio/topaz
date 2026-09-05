import { afterAll, vi } from "vitest";

import { closeDbConnection } from "@/server/db/client";

/**
 * Registered in a Vitest `setupFiles` entry, which Vitest guarantees runs
 * to completion before any test file's own module graph is evaluated --
 * unlike putting vi.mock() calls in a plain helper module that test files
 * import, where the auto-formatter's fixed import-group ordering (aliased
 * "@/..." imports always sort before relative "../test/..." ones) can put a
 * transitive real `next/headers` import ahead of this mock's registration,
 * silently caching the real module instead of the mock.
 */
export const headersRef: { current: Headers } = { current: new Headers() };
export const revalidateTagMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => null, getAll: () => [] }),
  headers: () => Promise.resolve(headersRef.current),
}));

vi.mock("next/cache", () => ({
  cacheLife: () => {
    // no-op: cacheLife() requires a real "use cache" build transform, which
    // plain vitest doesn't apply -- stubbed so "use cache" query functions
    // (getLibraryList, getLibraryStats, ...) can be called directly in tests.
  },
  cacheTag: () => {
    // no-op, see cacheLife() above.
  },
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

afterAll(async () => {
  await closeDbConnection();
});
