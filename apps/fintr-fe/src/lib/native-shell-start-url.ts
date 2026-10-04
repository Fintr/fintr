/**
 * Native test builds load `server.url` before any JavaScript runs. A root URL
 * compiles the marketing page, then the shell redirects to login. Start on
 * `/auth` so that first request is the login screen.
 */
export const withNativeAuthStartPath = (serverUrl: string): string => {
  let url: URL;

  try {
    url = new URL(serverUrl);
  } catch {
    return serverUrl;
  }

  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path !== "/") {
    return serverUrl;
  }

  url.pathname = "/auth/";
  return url.toString();
};
