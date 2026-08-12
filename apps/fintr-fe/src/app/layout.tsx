import type { Metadata, Viewport } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import {
  miniProfilerEarlyFetchQueueScript,
  miniProfilerInlineBootstrapScript,
  shouldEnableRackMiniProfiler,
} from "@/lib/rack-mini-profiler-inline-bootstrap";
import { buildServiceWorkerBootstrapScript } from "@/lib/service-worker-bootstrap-script";

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fintr - Save More. Spend Smarter. Afford The Life You Want.",
  description: "Manage your finances with ease using Fintr's comprehensive dashboard and analytics.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  minimumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#151921",
};

/**
 * Early error detection script - runs before React to catch initialization errors
 */
const EarlyErrorDetection = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          window.__earlyErrors = [];
          
          // Handle chunk load errors (common in Capacitor dev mode)
          window.addEventListener('error', function(e) {
            // Skip generic script errors
            if (!e.message || e.message === 'Script error.' || e.message === 'Script Error') {
              if (e.target && e.target.tagName === 'SCRIPT') {
                console.warn('[EarlyError] Script failed to load:', e.target.src);
              }
              return;
            }
            
            // Stale chunk after deploy: reload once so the user gets the new build.
            // Never auto-reload while offline — chunks cannot be fetched and reload loops.
            if (e.target && e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.includes('_next/static/chunks')) {
              if (navigator.onLine === false) {
                console.warn('[EarlyError] Chunk script failed while offline — skipping auto-reload');
                return;
              }

              try {
                var key = 'fintr_chunk_reload_at';
                var last = sessionStorage.getItem(key);
                var now = Date.now();
                if (!last || now - Number(last) >= 60000) {
                  sessionStorage.setItem(key, String(now));
                  window.location.reload();
                }
              } catch (err) {
                if (navigator.onLine !== false) {
                  window.location.reload();
                }
              }
              return;
            }
            
            const errorInfo = {
              message: e.message,
              filename: e.filename || 'inline/unknown',
              lineno: e.lineno || 0,
              colno: e.colno || 0,
              error: e.error ? (e.error.stack || e.error.toString()) : null,
              timestamp: Date.now()
            };
            window.__earlyErrors.push(errorInfo);
            console.error('[EarlyError]', JSON.stringify(errorInfo, null, 2));
          }, true);
          
          window.addEventListener('unhandledrejection', function(e) {
            const errorInfo = {
              type: 'unhandledrejection',
              reason: e.reason ? (e.reason.stack || e.reason.toString()) : null,
              timestamp: Date.now()
            };
            window.__earlyErrors.push(errorInfo);
            console.error('[EarlyUnhandledRejection]', JSON.stringify(errorInfo, null, 2));
          });
          
          // Override console.error to filter out known safe errors
          const originalError = console.error;
          console.error = function(...args) {
            const msg = args[0];
            if (typeof msg === 'string') {
              // Filter out SyntaxError warnings from incomplete chunks
              if (msg.includes('SyntaxError') && msg.includes('Unexpected end of input')) {
                console.warn('[Filtered] Incomplete chunk load error (safe to ignore in dev)');
                return;
              }
            }
            originalError.apply(console, args);
          };
        `,
      }}
    />
  );
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serviceWorkerUrl =
    process.env.NODE_ENV === "development" ? "/sw-dev.js" : "/sw.js";
  const serviceWorkerBootstrap = buildServiceWorkerBootstrapScript(serviceWorkerUrl);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <EarlyErrorDetection />
        <script
          dangerouslySetInnerHTML={{
            __html: serviceWorkerBootstrap,
          }}
        />
        <script
          src="https://blogger.kiron.app/connect.js"
          data-site-id="3"
          data-api-key="71b97f9302789af0b7819662214c939c491b43e72b9af960"
          data-api-url="https://blogger.kiron.app"
          async
        />
      </head>
      <body
        className={`${leagueSpartan.variable} antialiased ${leagueSpartan.className}`}
      >
        {shouldEnableRackMiniProfiler() &&
          process.env.NEXT_PUBLIC_BE_URL && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: miniProfilerEarlyFetchQueueScript(),
              }}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: miniProfilerInlineBootstrapScript(
                  process.env.NEXT_PUBLIC_BE_URL,
                ),
              }}
            />
          </>
        )}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
