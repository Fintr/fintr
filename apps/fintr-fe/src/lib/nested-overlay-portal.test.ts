import { afterEach, describe, expect, it } from "vitest";

import {
  getNestedOverlayPortalRoot,
  hasOpenNestedDismissible,
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

describe("hasOpenNestedDismissible", () => {
  afterEach(() => {
    document.getElementById("fintr-nested-overlay-root")?.remove();
    document.querySelector("[data-slot='select-content']")?.remove();
    document.querySelector("[data-filter-picker-popover]")?.remove();
  });

  it("is false when no nested picker or select is open", () => {
    expect(hasOpenNestedDismissible()).toBe(false);
  });

  it("is true when a filter picker popover is open", () => {
    const popover = document.createElement("div");
    popover.setAttribute("data-filter-picker-popover", "");
    document.body.appendChild(popover);

    expect(hasOpenNestedDismissible()).toBe(true);
  });

  it("is true when a select dropdown is open", () => {
    const select = document.createElement("div");
    select.setAttribute("data-slot", "select-content");
    document.body.appendChild(select);

    expect(hasOpenNestedDismissible()).toBe(true);
  });
});
