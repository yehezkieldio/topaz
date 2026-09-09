import path from "node:path";

import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
