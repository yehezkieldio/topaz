import { plugin } from "bun";

/**
 * Server Actions call headers() (to hand better-auth a real Headers object)
 * and revalidateTag() unconditionally after a mutation -- both require a
 * live Next.js request scope that a standalone script run via `bun` does not
 * have. This mirrors test/mock-next-runtime.ts's vi.mock approach using
 * Bun's virtual-module plugin API instead, so scripts/verify-*.ts can invoke
 * Server Actions directly without booting a Next.js server.
 *
 * Load via `bun --preload ./scripts/lib/next-runtime-mock.ts <script>`.
 */
export const headersRef: { current: Headers } = { current: new Headers() };

plugin({
  name: "next-runtime-mock",
  setup(build) {
    build.module("next/headers", () => ({
      exports: {
        cookies: () => Promise.resolve({ get: () => null, getAll: () => [] }),
        headers: () => Promise.resolve(headersRef.current),
      },
      loader: "object",
    }));

    build.module("next/cache", () => ({
      exports: {
        revalidateTag: (): void => {
          // no-op: no Next.js cache exists outside a real request scope
        },
      },
      loader: "object",
    }));

    // `server-only` throws when imported outside Next's own bundler --
    // stubbed here the same way vitest.config.ts aliases it for the test
    // suite (test/stubs/server-only.ts), so requireAdmin() and friends can
    // be imported directly under a plain `bun` process.
    build.module("server-only", () => ({
      exports: {},
      loader: "object",
    }));
  },
});
