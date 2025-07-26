import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: [
      "fintr-development.s3.ap-southeast-1.amazonaws.com",
      "raw.githubusercontent.com"
    ],
  },
};

export default nextConfig;
