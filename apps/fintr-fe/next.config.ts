import type { NextConfig } from "next";

import { nextDevRewrites } from "./src/lib/next-dev-rewrites";

const nextConfig: NextConfig = {
  transpilePackages: ["@fintr/domain"],
  allowedDevOrigins: ["10.0.2.2"],
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return nextDevRewrites(
      process.env.NEXT_PUBLIC_BE_URL ?? "http://localhost:3001",
    );
  },
  output: "export",
  typescript: { ignoreBuildErrors: true },
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
    // The default Turbopack FS cache grew to 14GB here and took the Mac down.
    turbopackFileSystemCacheForDev: false,
    turbopackMemoryLimit: 2 * 1024 * 1024 * 1024,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fintr-development.s3.ap-southeast-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fintr-staging.s3.ap-southeast-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fintr-production.s3.ap-southeast-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3.ap-southeast-1.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};
export default nextConfig;
