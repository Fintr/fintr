import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CustomModal } from "./custom-modal";

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => false,
}));

describe("CustomModal mobile positioning", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("pins mobile modal container to top-left", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const content = document.querySelector("[data-modal-content]") as HTMLElement | null;
    expect(content).toBeTruthy();
    const wrapper = content?.parentElement as HTMLElement | null;
    expect(wrapper?.className).toContain("items-start");
    expect(wrapper?.className).toContain("justify-start");
  });

  it("keeps desktop modal container centered", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    render(
      <CustomModal
        isOpen
        onClose={() => {}}
        title="Add Transaction"
      >
        <div>content</div>
      </CustomModal>,
    );

    await waitFor(() => {
      expect(screen.getByText("Add Transaction")).toBeInTheDocument();
    });

    const content = document.querySelector("[data-modal-content]") as HTMLElement | null;
    expect(content).toBeTruthy();
    const wrapper = content?.parentElement as HTMLElement | null;
    expect(wrapper?.className).toContain("items-center");
    expect(wrapper?.className).toContain("justify-center");
  });
});
