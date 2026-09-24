import { afterEach, describe, expect, it, vi } from "vitest";
import { PROFILE_IMAGE_PATHS } from "@/lib/insights/profile-catalog";
import { warmInsightProfileImages } from "./warm-insight-profile-images";

describe("warmInsightProfileImages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("puts missing profile images into the fintr shell cache when online", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({ match, put });
    const keys = vi
      .fn()
      .mockResolvedValue(["fintr-shell-test"]);

    vi.stubGlobal("caches", { keys, open });
    vi.stubGlobal("navigator", { onLine: true });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      clone: () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await warmInsightProfileImages();

    expect(open).toHaveBeenCalledWith("fintr-shell-test");
    expect(fetchMock).toHaveBeenCalledTimes(
      Object.keys(PROFILE_IMAGE_PATHS).length,
    );
    expect(put).toHaveBeenCalled();
  });

  it("skips work when offline", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: false });

    await warmInsightProfileImages();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
