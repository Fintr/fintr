import { afterEach, describe, expect, it } from "vitest";

import { syncDocumentScreenClass } from "./document-screen-class";

describe("syncDocumentScreenClass", () => {
  afterEach(() => {
    document.documentElement.className = "";
  });

  it("adds the class only while the screen is active", () => {
    const cleanup = syncDocumentScreenClass("fintr-home-screen", true);

    expect(document.documentElement.classList.contains("fintr-home-screen")).toBe(
      true,
    );

    cleanup();
    expect(document.documentElement.classList.contains("fintr-home-screen")).toBe(
      false,
    );
  });

  it("does not leave the class on an inactive kept-alive screen", () => {
    syncDocumentScreenClass("fintr-home-screen", true);
    const cleanup = syncDocumentScreenClass("fintr-home-screen", false);

    expect(document.documentElement.classList.contains("fintr-home-screen")).toBe(
      false,
    );

    cleanup();
  });
});
