import { vi } from "vitest";

/**
 * requireAdmin() reads next/headers' headers() to hand better-auth a real
 * Headers object -- outside a Next.js request scope (i.e. in vitest) that
 * call throws. Tests import this module first, then set `headersRef.current`
 * to fixture headers (see createAuthHeaders in db-helpers.ts) before invoking
 * a Server Action.
 */
export const headersRef: { current: Headers } = { current: new Headers() };

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => null, getAll: () => [] }),
  headers: () => Promise.resolve(headersRef.current),
}));

/**
 * revalidateTag() requires a static-generation store that only exists inside
 * a real Next.js request -- Server Actions call it unconditionally after a
 * successful mutation, so exercising the mutation logic in vitest needs it
 * stubbed out. This does not touch the cacheTag()/cacheLife() read side.
 */
vi.mock("next/cache", () => ({
  revalidateTag: () => null,
}));
