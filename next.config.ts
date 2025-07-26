import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["fintr-development.s3.ap-southeast-1.amazonaws.com"],
  },
};

export default nextConfig;
