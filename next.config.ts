import type { NextConfig } from "next";
import packageJson from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.137.2"],
    cacheComponents: true,
    env: {
        NEXT_PUBLIC_VERSION: packageJson.version,
    },
    experimental: {
        turbopackFileSystemCacheForDev: true,
    },
    images: {
        remotePatterns: [
            {
                hostname: "cdn.discordapp.com",
                protocol: "https",
            },
        ],
    },
    reactCompiler: true,
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
