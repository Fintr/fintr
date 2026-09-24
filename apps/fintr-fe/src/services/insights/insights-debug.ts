const isInsightsDebugHost = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
  );
};

export const logInsightsDebug = (
  message: string,
  payload?: Record<string, unknown>,
): void => {
  if (!isInsightsDebugHost()) {
    return;
  }

  if (payload) {
    console.info(`[insights] ${message}`, payload);
    return;
  }

  console.info(`[insights] ${message}`);
};
