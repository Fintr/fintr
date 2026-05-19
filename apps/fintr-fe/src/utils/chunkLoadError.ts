const CHUNK_RELOAD_STORAGE_KEY = "fintr_chunk_reload_at";
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

const CHUNK_LOAD_MESSAGE_PATTERNS = [
  /loading chunk \d+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
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

/**
 * Reload once to pick up a fresh build after a deployment. Returns false when
 * a reload was attempted recently so callers can show a manual recovery UI.
 */
export function reloadForStaleChunks(): boolean {
  if (typeof window === "undefined") {
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

  return reloadForStaleChunks();
}
