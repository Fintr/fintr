import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listShellCacheNames,
  resolveShellCachedAssetObjectUrl,
} from "./resolve-shell-cached-asset";

describe("resolveShellCachedAssetObjectUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a blob object URL from any fintr-shell cache", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const match = vi.fn().mockImplementation((request: string) => {
      if (request === "/profiles/debt_crusher.png") {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(blob),
        });
      }

      return Promise.resolve(undefined);
    });
    const open = vi.fn().mockResolvedValue({ match });
    const keys = vi
      .fn()
      .mockResolvedValue(["fintr-shell-old", "fintr-shell-new"]);

    vi.stubGlobal("caches", { keys, open });

    if (typeof URL.createObjectURL === "function") {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:debt-crusher");
    } else {
      // jsdom may not implement createObjectURL; stub minimally for this test.
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:debt-crusher"),
      });
    }

    const objectUrl = await resolveShellCachedAssetObjectUrl(
      "/profiles/debt_crusher.png",
    );

    expect(objectUrl).toBe("blob:debt-crusher");
    expect(open).toHaveBeenCalled();
  });

  it("lists shell caches newest first", async () => {
    const keys = vi
      .fn()
      .mockResolvedValue(["fintr-shell-1", "fintr-shell-9", "other"]);

    vi.stubGlobal("caches", { keys });

    await expect(listShellCacheNames()).resolves.toEqual([
      "fintr-shell-9",
      "fintr-shell-1",
    ]);
  });
});
