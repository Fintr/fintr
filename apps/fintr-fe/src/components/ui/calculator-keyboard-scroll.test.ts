import { describe, it, expect, afterEach } from "vitest";
import {
  acquireCalculatorScrollPadding,
  findScrollableAncestor,
  keyboardLayoutReservesScrollSpace,
  releaseCalculatorScrollPadding,
} from "./calculator-keyboard-scroll";

describe("calculator-keyboard-scroll", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds the modal scroll body for inputs inside CustomModal", () => {
    document.body.innerHTML = `
      <div data-modal-content>
        <div class="flex-1 overflow-y-auto">
          <form>
            <input id="amount" />
          </form>
        </div>
      </div>
    `;

    const input = document.getElementById("amount") as HTMLInputElement;
    const scrollParent = findScrollableAncestor(input);

    expect(scrollParent?.classList.contains("overflow-y-auto")).toBe(true);
  });

  it("ref-counts scroll padding on the same container", () => {
    const scrollParent = document.createElement("div");
    scrollParent.style.paddingBottom = "8px";

    acquireCalculatorScrollPadding(scrollParent, 240);
    acquireCalculatorScrollPadding(scrollParent, 240);

    expect(scrollParent.style.paddingBottom).toBe("240px");

    releaseCalculatorScrollPadding(scrollParent);
    expect(scrollParent.style.paddingBottom).toBe("240px");

    releaseCalculatorScrollPadding(scrollParent);
    expect(scrollParent.style.paddingBottom).toBe("8px");
  });

  it("only reserves scroll space for overlapping keyboard layouts", () => {
    expect(keyboardLayoutReservesScrollSpace("bottom-sheet")).toBe(true);
    expect(keyboardLayoutReservesScrollSpace("floating")).toBe(true);
    expect(keyboardLayoutReservesScrollSpace("below")).toBe(false);
    expect(keyboardLayoutReservesScrollSpace("above")).toBe(false);
  });
});
