import type { Metadata, Viewport } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import {
  miniProfilerEarlyFetchQueueScript,
  miniProfilerInlineBootstrapScript,
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
            
            // Skip chunk loading errors - they're handled by Next.js
            if (e.target && e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.includes('_next/static/chunks')) {
              console.warn('[EarlyError] Next.js chunk load error (usually recovers):', e.target.src);
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
    <html lang="en">
      <head>
        <EarlyErrorDetection />
      </head>
      <body
        className={`${leagueSpartan.variable} antialiased ${leagueSpartan.className}`}
      >
        {process.env.NODE_ENV === "development" &&
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
