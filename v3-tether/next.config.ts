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
  // @libsql/client is on this default allow-list already, but declared
  // explicitly since it's load-bearing here: bun:sqlite (tried first) does
  // not survive Next's jest-worker-based page-data-collection phase in
  // either dev or build, which is the reason this app uses libsql instead
  // -- see docs/BUN_SQLITE_NEXT_BUILD.md for the full investigation.
  serverExternalPackages: ["@libsql/client"],
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
