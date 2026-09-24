const APP_SHELL_READY_KEY = "fintr:appShellReady";

/** True once the private app shell has rendered in this tab. */
export const hasAppShellReady = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(APP_SHELL_READY_KEY) === "1";
  } catch {
    return false;
  }
};

/** Latch the shell as ready — full-screen splashes must not return this session. */
export const markAppShellReady = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(APP_SHELL_READY_KEY, "1");
  } catch {
    // Ignore quota / private mode errors.
  }
};

export const clearAppShellReadyForTests = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(APP_SHELL_READY_KEY);
  } catch {
    // Ignore storage errors in tests.
  }
};
