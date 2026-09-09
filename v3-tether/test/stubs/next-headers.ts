// Stubs `next/headers` for tests: resolved via vitest.config.ts's
// resolve.alias (the same mechanism used for test/stubs/server-only.ts)
// instead of vi.mock(), so there's no module-registry interception and no
// import-order race with a transitive real `next/headers` import getting
// cached first -- this redirect happens at module-resolution time, before
// any module is evaluated.
import { headersRef } from "../setup";

export const cookies = () =>
  Promise.resolve({ get: () => null, getAll: () => [] });

export const headers = () => Promise.resolve(headersRef.current);
