const LAST_AUTH_USER_SUB_KEY = "fintr:lastAuthUserSub";

/**
 * Account context (onboarding step, membership) comes from the server while
 * online. Offline sync must not skip that request.
 */
export const shouldSkipCurrentUserNetworkFetch = (isOnline: boolean): boolean =>
  !isOnline;

export const shouldApplyCachedWorkspaceContext = (params: {
  hasCachedCurrentUser: boolean;
  hasNetworkCurrentUser: boolean;
  skipNetworkFetch: boolean;
}): boolean =>
  params.hasCachedCurrentUser
  && !params.hasNetworkCurrentUser
  && params.skipNetworkFetch;

export const readLastAuthUserSub = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(LAST_AUTH_USER_SUB_KEY) ?? "";
  } catch {
    return "";
  }
};

/**
 * Remember who is signed in. A different account drops the previous
 * workspace code so first-time setup is not skipped for the new account.
 */
export const adoptSignedInUser = (userSub: string): { changed: boolean } => {
  if (!userSub || typeof window === "undefined") {
    return { changed: false };
  }

  const previous = readLastAuthUserSub();

  if (!previous || previous === userSub) {
    if (!previous) {
      window.localStorage.setItem(LAST_AUTH_USER_SUB_KEY, userSub);
    }

    return { changed: false };
  }

  window.localStorage.removeItem("spaceCode");
  window.localStorage.setItem(LAST_AUTH_USER_SUB_KEY, userSub);

  return { changed: true };
};
