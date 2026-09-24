import { describe, expect, it } from "vitest";

import {
  TAG_STYLE_PRESETS,
  isTagStylePresetKey,
  resolveTagStyleImageUrl,
  tagStylePresetSrc,
} from "./preset-style-images";

describe("TAG_STYLE_PRESETS", () => {
  it("includes 20 assignable sample images", () => {
    expect(TAG_STYLE_PRESETS).toHaveLength(20);
  });

  it("starts with Japan vacation and Vacation", () => {
    expect(TAG_STYLE_PRESETS[0]).toMatchObject({
      key: "japan-vacation",
      label: "Japan vacation",
    });
    expect(TAG_STYLE_PRESETS[1]).toMatchObject({
      key: "europe-vacation",
      label: "Vacation",
    });
  });

  it("points each preset at a public /tags asset", () => {
    for (const preset of TAG_STYLE_PRESETS) {
      expect(preset.src).toBe(`/tags/${preset.key}.png`);
    }
  });
});

describe("isTagStylePresetKey", () => {
  it("accepts catalog keys", () => {
    expect(isTagStylePresetKey("japan-vacation")).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(isTagStylePresetKey("not-a-preset")).toBe(false);
  });
});

describe("resolveTagStyleImageUrl", () => {
  it("prefers an attached custom style image", () => {
    expect(
      resolveTagStyleImageUrl({
        styleImageUrl: "https://cdn.example/custom.png",
        stylePresetKey: "japan-vacation",
      }),
    ).toBe("https://cdn.example/custom.png");
  });

  it("falls back to the bundled preset asset", () => {
    expect(
      resolveTagStyleImageUrl({
        stylePresetKey: "europe-vacation",
      }),
    ).toBe(tagStylePresetSrc("europe-vacation"));
  });

  it("returns undefined when neither source is present", () => {
    expect(resolveTagStyleImageUrl({})).toBeUndefined();
  });
});
