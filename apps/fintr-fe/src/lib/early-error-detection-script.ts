/**
 * Inline bootstrap for root layout. Runs before React hydration to capture early
 * errors and recover from stale chunk loads after deploys.
 */
export function buildEarlyErrorDetectionScript(): string {
  return `
          if (location.pathname.slice(-4) === ".txt") {
            location.replace(location.pathname.slice(0, -4) + location.search + location.hash);
          }

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
          //# sourceURL=fintr-early-error-detection.js
        `;
}
