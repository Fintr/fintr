import type { Metadata, Viewport } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import {
  miniProfilerEarlyFetchQueueScript,
  miniProfilerInlineBootstrapScript,
  shouldEnableRackMiniProfiler,
} from "@/lib/rack-mini-profiler-inline-bootstrap";

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
            
            // Stale chunk after deploy: reload once so the user gets the new build
            if (e.target && e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.includes('_next/static/chunks')) {
              try {
                var key = 'fintr_chunk_reload_at';
                var last = sessionStorage.getItem(key);
                var now = Date.now();
                if (!last || now - Number(last) >= 60000) {
                  sessionStorage.setItem(key, String(now));
                  window.location.reload();
                }
              } catch (err) {
                window.location.reload();
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <EarlyErrorDetection />
        <script
          src="http://localhost:3003/connect.js"
          data-site-id="2"
          data-api-key="963a0bf2396683f7fd66898b80f4767da8f51084c822b0eb"
          data-api-url="http://localhost:3003"
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
