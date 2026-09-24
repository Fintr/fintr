import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createFileInputChangeEvent, pickDeviceImage } from "./pick-device-image";

beforeAll(() => {
  if (typeof DataTransfer === "undefined") {
    class MockDataTransfer {
      private filesList: File[] = [];

      items = {
        add: (file: File) => {
          this.filesList.push(file);
        },
      };

      get files(): FileList {
        const files = this.filesList;
        return {
          length: files.length,
          item: (index: number) => files[index] ?? null,
          ...Object.fromEntries(files.map((file, index) => [index, file])),
        } as FileList;
      }
    }

    globalThis.DataTransfer = MockDataTransfer as typeof DataTransfer;
  }
});

describe("pickDeviceImage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("creates a hidden file input with camera capture attributes", async () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const click = vi.fn();

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);

      if (tagName === "input") {
        element.click = click;
      }

      return element;
    });

    const pending = pickDeviceImage();
    await Promise.resolve();

    const appendedInput = appendChild.mock.calls.at(-1)?.[0] as HTMLInputElement | undefined;

    expect(appendedInput?.type).toBe("file");
    expect(appendedInput?.accept).toBe("image/*");
    expect(appendedInput?.capture).toBe("environment");
    expect(click).toHaveBeenCalled();

    appendedInput?.dispatchEvent(new Event("change"));
    await expect(pending).resolves.toBeNull();
  });
});

describe("createFileInputChangeEvent", () => {
  it("wraps a file in a change event", () => {
    const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });
    const event = createFileInputChangeEvent(file);

    expect(event.target.files?.[0]).toBe(file);
  });
});
