const SESSION_KEY = "fintr.clientTabId";

export const CLIENT_TAB_ID_HEADER = "X-Client-Tab-Id";

const newClientTabId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Stable per-browser-tab id (sessionStorage is isolated per tab). */
export const getClientTabId = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = sessionStorage.getItem(SESSION_KEY)?.trim();
    if (existing) {
      return existing;
    }

    const created = newClientTabId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "";
  }
};

/** True when the ActionCable payload originated on this tab. */
export const isRealtimeOriginFromThisTab = (
  originTabId: string | null | undefined,
): boolean => {
  const origin = originTabId?.trim();
  if (!origin) {
    return false;
  }

  const selfTabId = getClientTabId();
  return Boolean(selfTabId) && origin === selfTabId;
};
