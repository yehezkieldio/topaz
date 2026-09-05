// Stubs `next/cache` for tests -- see test/stubs/next-headers.ts for why
// this is a resolve.alias redirect rather than vi.mock().
import { revalidateTagMock } from "../setup";

export const cacheLife = () => {
  // no-op: cacheLife() requires a real "use cache" build transform, which
  // plain vitest doesn't apply -- stubbed so "use cache" query functions
  // (getLibraryList, getLibraryStats, ...) can be called directly in tests.
};

export const cacheTag = () => {
  // no-op, see cacheLife() above.
};

export const revalidateTag = (...args: unknown[]) => revalidateTagMock(...args);
