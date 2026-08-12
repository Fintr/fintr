import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
  reloadForStaleChunks,
} from "./chunkLoadError";

describe("isChunkLoadError", () => {
  it("detects ChunkLoadError by name", () => {
    const error = new Error("Loading chunk 8518 failed.");
    error.name = "ChunkLoadError";

    expect(isChunkLoadError(error)).toBe(true);
  });

  it("detects webpack chunk load messages", () => {
    expect(
      isChunkLoadError(new Error("Loading chunk 8518 failed.")),
    ).toBe(true);
  });

  it("detects dynamic import failures", () => {
    expect(
      isChunkLoadError(
        new Error("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("reloadForStaleChunks", () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("location", { reload });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reloads the page when no recent attempt exists", () => {
    expect(reloadForStaleChunks()).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("fintr_chunk_reload_at")).not.toBeNull();
  });

  it("skips reload when attempted within the cooldown window", () => {
    sessionStorage.setItem("fintr_chunk_reload_at", String(Date.now()));

    expect(reloadForStaleChunks()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("skips reload while offline", () => {
    vi.stubGlobal("navigator", { onLine: false });

    expect(reloadForStaleChunks()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("recoverFromChunkLoadError", () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("location", { reload });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reloads only for chunk load errors", () => {
    const error = new Error("Loading chunk 42 failed.");
    error.name = "ChunkLoadError";

    expect(recoverFromChunkLoadError(error)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does nothing for unrelated errors", () => {
    expect(recoverFromChunkLoadError(new Error("boom"))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
