import { AuthStorage } from "@/lib/auth-storage";
import {
  isRejectedRefresh,
  refreshAccessToken,
  type LoginResponse,
} from "@/services/auth/login";

export const SESSION_CHECK_INTERVAL_MS = 60_000;

let refreshInFlight: Promise<LoginResponse> | null = null;

const refreshAndStore = async (): Promise<LoginResponse> => {
  const authData = AuthStorage.getAuthData();
  const refreshToken = authData?.tokens.refresh_token;
  if (!authData || !refreshToken) {
    throw Object.assign(new Error("No refresh token"), { status: 401 });
  }

  const newTokens = await refreshAccessToken(refreshToken);
  const tokens = {
    ...newTokens,
    refresh_token: newTokens.refresh_token || refreshToken,
  };

  AuthStorage.setAuthData({
    tokens,
    user: AuthStorage.decodeJWT(tokens.id_token) ?? authData.user,
    expires_at: Date.now() + tokens.expires_in * 1000,
    issued_at: Date.now(),
  });

  return tokens;
};

/**
 * Refresh the stored session and persist the new tokens. Concurrent callers share
 * one request: with refresh-token rotation, a second request reusing the old
 * refresh token would be rejected and log the user out.
 */
export const refreshStoredSession = (): Promise<LoginResponse> => {
  refreshInFlight ??= refreshAndStore().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

/**
 * Keep the session alive ahead of expiry so a save never meets a dead token. If the
 * auth server refuses to refresh, report expiry now — before the user starts work —
 * instead of on their next request. Offline or 5xx failures keep the session.
 */
export const ensureFreshSession = async ({
  onRefreshed,
  onExpired,
}: {
  onRefreshed: (tokens: LoginResponse) => void;
  onExpired: () => void;
}): Promise<void> => {
  if (!AuthStorage.needsRefresh()) {
    return;
  }

  if (!AuthStorage.getRefreshToken()) {
    if (AuthStorage.isSessionExpired()) {
      onExpired();
    }
    return;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  try {
    onRefreshed(await refreshStoredSession());
  } catch (error) {
    if (isRejectedRefresh(error)) {
      onExpired();
    }
  }
};
