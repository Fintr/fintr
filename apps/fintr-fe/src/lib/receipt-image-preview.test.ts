import { describe, expect, it, vi } from "vitest";
import {
  isReceiptImageFile,
  prepareReceiptImagePreview,
} from "./receipt-image-preview";

describe("isReceiptImageFile", () => {
  it("accepts standard image mime types", () => {
    const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });

    expect(isReceiptImageFile(file)).toBe(true);
  });

  it("accepts image files with empty mime types when the extension is image-like", () => {
    const file = new File(["content"], "receipt.heic", { type: "" });

    expect(isReceiptImageFile(file)).toBe(true);
  });

  it("rejects non-image files", () => {
    const file = new File(["content"], "notes.txt", { type: "text/plain" });

    expect(isReceiptImageFile(file)).toBe(false);
  });
});

describe("prepareReceiptImagePreview", () => {
  it("returns an object URL for displayable images", async () => {
    const file = new File(["content"], "receipt.png", { type: "image/png" });

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:preview");
      URL.revokeObjectURL = vi.fn();
    }

    const preview = await prepareReceiptImagePreview(file);

    expect(preview.file).toBe(file);
    expect(preview.previewUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(preview.previewUrl);
  });
});
