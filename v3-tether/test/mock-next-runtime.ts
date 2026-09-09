/**
 * The actual vi.mock() registration for next/headers and next/cache lives in
 * test/setup.ts (a Vitest `setupFiles` entry, guaranteed to run before any
 * test file's own imports) -- re-exported here so existing test files can
 * keep importing `headersRef`/`revalidateTagMock` from this path.
 */
export { headersRef, revalidateTagMock } from "./setup";
