import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddReceiptDialog } from "./add-receipt-dialog";

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
};

const dialogContent = () =>
  document.querySelector("[data-add-receipt-dialog-content]");

describe("AddReceiptDialog", () => {
  it("stays a compact dialog on desktop when fullScreen is set", async () => {
    setViewportWidth(1280);

    render(
      <AddReceiptDialog
        isOpen
        fullScreen
        title="Add Receipt"
        onClose={() => undefined}
      >
        <div>Receipt options</div>
      </AddReceiptDialog>,
    );

    expect(
      await screen.findByRole("heading", { name: "Add Receipt" }),
    ).toBeInTheDocument();

    expect(dialogContent()).toHaveClass("max-w-md");
    expect(dialogContent()).not.toHaveClass("h-dvh");
  });

  it("fills the viewport on mobile when fullScreen is set", async () => {
    setViewportWidth(390);

    render(
      <AddReceiptDialog
        isOpen
        fullScreen
        title="Add Receipt"
        onClose={() => undefined}
      >
        <div>Receipt options</div>
      </AddReceiptDialog>,
    );

    expect(
      await screen.findByRole("heading", { name: "Add Receipt" }),
    ).toBeInTheDocument();

    expect(dialogContent()).toHaveClass("h-dvh");
  });
});
