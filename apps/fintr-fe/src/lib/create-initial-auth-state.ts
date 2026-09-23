import {
  AuthStorage,
  type AuthUser,
} from "@/lib/auth-storage";
import type { LoginResponse } from "@/services/auth/login";

export type StoredAuthSession = {
  user: AuthUser | null;
  tokens: LoginResponse | null;
  isLoading: boolean;
};

export const getServerAuthState = (): StoredAuthSession => ({
  user: null,
  tokens: null,
  isLoading: true,
});

export const createInitialAuthState = (): StoredAuthSession => {
  if (typeof window === "undefined") {
    return { user: null, tokens: null, isLoading: true };
  }

  try {
    AuthStorage.migrateFromOldFormat();
    const authData = AuthStorage.getAuthData();

    if (authData) {
      return {
        user: authData.user,
        tokens: {
          access_token: authData.tokens.access_token,
          id_token: authData.tokens.id_token,
          refresh_token: authData.tokens.refresh_token,
          expires_in: authData.tokens.expires_in,
          token_type: authData.tokens.token_type,
          scope: authData.tokens.scope,
        },
        isLoading: false,
      };
    }
  } catch {
    // Ignore storage errors and fall through to a cold-start loading state.
  }

  return { user: null, tokens: null, isLoading: true };
};
