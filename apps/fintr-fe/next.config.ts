import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProductionLike =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "staging";

const nextConfig: NextConfig = {
  // Only enable static export for production/staging builds (slows down dev server)
  output: isProductionLike ? "export" : undefined,
  typescript: { ignoreBuildErrors: true },
  // App Router only: do not add `src/pages/*` (hybrid Pages+App breaks "Collecting
  // page data" with PageNotFoundError for app routes like /admin). These flags
  // reduce races on internal pages/_document during static export builds.
  // Only apply throttling in production/staging builds
  experimental: isProductionLike ? {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
  } : undefined,
  images: {
    unoptimized: true,
    domains: [
      "fintr-development.s3.ap-southeast-1.amazonaws.com",
      "fintr-staging.s3.ap-southeast-1.amazonaws.com",
      "fintr-production.s3.ap-southeast-1.amazonaws.com",
      "s3.ap-southeast-1.amazonaws.com",
      "raw.githubusercontent.com"
    ],
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
};

// Skip Sentry config wrapper in development for faster dev server
const config = isProductionLike
  ? withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://www.npmjs.com/package/@sentry/webpack-plugin#options

      org: "fintr",

      project: "nextjs",

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      // tunnelRoute: "/monitoring",

      webpack: {
        // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: true,

        // Tree-shaking options for reducing bundle size
        treeshake: {
          // Automatically tree-shake Sentry logger statements to reduce bundle size
          removeDebugLogging: true,
        },
      },
    })
  : nextConfig;

export default config;
