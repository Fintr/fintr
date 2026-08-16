const CHUNK_RELOAD_STORAGE_KEY = "fintr_chunk_reload_at";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const OFFLINE_CHUNK_HOME_KEY = "fintr_offline_chunk_home";
const OFFLINE_SHELL_PATH = "/dashboard/home";

const readBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const CHUNK_LOAD_MESSAGE_PATTERNS = [
  /loading chunk \d+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /failed to load chunk/i,
  /loading chunk script failed/i,
];

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return String(error);
}

export function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  return "";
}

/**
 * True when the browser failed to load a JS chunk, usually because a new
 * deployment removed hashed files while the user still has an old bundle.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const name = getErrorName(error);
  const message = getErrorMessage(error);

  if (name === "ChunkLoadError") {
    return true;
  }

  return CHUNK_LOAD_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname || "/";
};

export function canRecoverOfflineChunkNavigation(): boolean {
  if (readBrowserOnline()) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    if (sessionStorage.getItem(OFFLINE_CHUNK_HOME_KEY)) {
      return false;
    }
  } catch {
    // sessionStorage may be unavailable; still allow a single home navigation
  }

  const path = normalizePathname(window.location.pathname);
  return path !== OFFLINE_SHELL_PATH && path !== "/dashboard";
}

export function recoverOfflineChunkNavigation(): boolean {
  if (!canRecoverOfflineChunkNavigation()) {
    return false;
  }

  try {
    sessionStorage.setItem(OFFLINE_CHUNK_HOME_KEY, "1");
  } catch {
    // still attempt a single navigation
  }

  window.location.replace(OFFLINE_SHELL_PATH);
  return true;
}

/**
 * Reload once to pick up a fresh build after a deployment. Returns false when
 * a reload was attempted recently so callers can show a manual recovery UI.
 */
export function reloadForStaleChunks(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!readBrowserOnline()) {
    return false;
  }

  try {
    const lastReloadAt = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const now = Date.now();

    if (
      lastReloadAt &&
      now - Number(lastReloadAt) < CHUNK_RELOAD_COOLDOWN_MS
    ) {
      return false;
    }

    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // sessionStorage may be unavailable; still attempt a single reload
  }

  window.location.reload();
  return true;
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }

  if (!readBrowserOnline()) {
    return recoverOfflineChunkNavigation();
  }

  return reloadForStaleChunks();
}
