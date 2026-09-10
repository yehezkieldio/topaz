import path from "node:path";

import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packages each `next build` into one self-contained Bun executable per
  // device (08_sync/02_packaging_and_lifecycle.md) -- no separate
  // output: "standalone" step, the adapter supersedes it.
  adapterPath: "next-bun-compile",
  cacheComponents: true,
  reactCompiler: true,
  // KNOWN BROKEN as of Next 16.3.4 + next-bun-compile 2.0.0 + Bun 1.3.11
  // (verified by actually running `bun run build`, not assumed): Next's
  // page-data-collection phase spawns jest-worker child processes/threads
  // to statically load each route module, and neither mode resolves
  // `bun:sqlite` (a Bun runtime built-in, not an npm package) --
  // serverExternalPackages doesn't help either, since that only affects
  // Node-style `node_modules` resolution, not a `bun:` protocol specifier.
  // See docs/BUN_SQLITE_NEXT_BUILD.md for the full investigation and
  // what to try when picking this back up.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
