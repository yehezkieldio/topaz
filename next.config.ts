import type { NextConfig } from "next";
import packageJson from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.discordapp.com",
            },
        ],
    },
    env: {
        NEXT_PUBLIC_VERSION: packageJson.version,
    },
    reactCompiler: true,
    cacheComponents: true,
    experimental: {
        turbopackFileSystemCacheForDev: true,
    },
    allowedDevOrigins: ["192.168.137.2"],
};

export default nextConfig;
