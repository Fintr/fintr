import { describe, expect, it } from "vitest";

import { extractRemoteFiles } from "./remote-files";

describe("extractRemoteFiles", () => {
  it("reads camelCase file payloads", () => {
    expect(
      extractRemoteFiles({
        files: [
          {
            id: "1",
            url: "https://example.com/a.jpg",
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
      }),
    ).toEqual([
      {
        id: "1",
        url: "https://example.com/a.jpg",
        filename: "a.jpg",
        contentType: "image/jpeg",
        byteSize: undefined,
      },
    ]);
  });

  it("reads snake_case file payloads", () => {
    expect(
      extractRemoteFiles({
        files: [
          {
            id: "1",
            url: "https://example.com/a.jpg",
            filename: "a.jpg",
            content_type: "image/jpeg",
          },
        ],
      }),
    ).toEqual([
      {
        id: "1",
        url: "https://example.com/a.jpg",
        filename: "a.jpg",
        contentType: "image/jpeg",
        byteSize: undefined,
      },
    ]);
  });

  it("rewrites the legacy development bucket", () => {
    expect(
      extractRemoteFiles({
        files: [
          {
            url: "https://storage.googleapis.com/fintr-dev/spaces/space-a/receipt.jpg",
          },
        ],
      }),
    ).toEqual([
      {
        id: undefined,
        url: "https://storage.googleapis.com/fintr-development/spaces/space-a/receipt.jpg",
        filename: undefined,
        contentType: undefined,
        byteSize: undefined,
      },
    ]);
  });

  it("drops files without a url", () => {
    expect(
      extractRemoteFiles({
        files: [{ filename: "a.jpg", contentType: "image/jpeg" }],
      }),
    ).toEqual([]);
  });
});
