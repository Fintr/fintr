import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_ATTACHMENT_IMAGE_EDGE } from "./constants";
import { maybeCompressAttachmentBlob } from "./compress";

const originalCreateImageBitmap = globalThis.createImageBitmap;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    // @ts-expect-error restore missing bitmap API
    delete globalThis.createImageBitmap;
  }
});

describe("maybeCompressAttachmentBlob", () => {
  it("leaves non-image blobs unchanged", async () => {
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });

    await expect(maybeCompressAttachmentBlob(file)).resolves.toBe(file);
  });

  it("leaves GIFs unchanged so animation is preserved", async () => {
    const file = new File(["gif"], "receipt.gif", { type: "image/gif" });

    await expect(maybeCompressAttachmentBlob(file)).resolves.toBe(file);
  });

  it("downscales large images to JPEG within the max edge", async () => {
    const source = new File(["raw-photo"], "receipt.png", { type: "image/png" });
    const compressedBytes = new Uint8Array([0xff, 0xd8, 0xff]);

    const close = vi.fn();
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 3200,
      height: 2400,
      close,
    })) as unknown as typeof createImageBitmap;

    const toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob([compressedBytes], { type: "image/jpeg" }));
    });
    const drawImage = vi.fn();

    vi.stubGlobal(
      "document",
      {
        createElement: vi.fn(() => ({
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toBlob,
        })),
      } as unknown as Document,
    );

    const result = await maybeCompressAttachmentBlob(source);

    expect(result).toBeInstanceOf(File);
    expect(result).not.toBe(source);
    expect((result as File).name).toBe("receipt.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBe(compressedBytes.byteLength);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      MAX_ATTACHMENT_IMAGE_EDGE,
      1200,
    );
    expect(close).toHaveBeenCalled();
  });

  it("returns the original file when canvas encoding fails", async () => {
    const source = new File(["raw-photo"], "receipt.jpg", {
      type: "image/jpeg",
    });

    globalThis.createImageBitmap = vi.fn(async () => {
      throw new Error("decode failed");
    }) as unknown as typeof createImageBitmap;

    await expect(maybeCompressAttachmentBlob(source)).resolves.toBe(source);
  });
});
