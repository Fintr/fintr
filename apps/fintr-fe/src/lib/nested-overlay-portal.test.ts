import { afterEach, describe, expect, it } from "vitest";

import {
  getNestedOverlayPortalRoot,
  NESTED_OVERLAY_LAYER_Z_INDEX,
} from "./nested-overlay-portal";

describe("getNestedOverlayPortalRoot", () => {
  afterEach(() => {
    const root = document.getElementById("fintr-nested-overlay-root");
    root?.remove();
  });

  it("does not move the portal root when called repeatedly", () => {
    const first = getNestedOverlayPortalRoot();

    const sentinel = document.createElement("div");
    sentinel.id = "fintr-portal-sentinel";
    document.body.appendChild(sentinel);

    const second = getNestedOverlayPortalRoot();

    expect(first).toBe(second);
    expect(document.body.lastElementChild).toBe(sentinel);
    expect(first?.style.zIndex).toBe(String(NESTED_OVERLAY_LAYER_Z_INDEX));

    sentinel.remove();
  });
});
