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
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
