import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CurrencySelectorSheet } from "@/components/ui/currency-selector-sheet";

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

describe("CurrencySelectorSheet close", () => {
  it("slides the sheet closed before committing the selected currency", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CurrencySelectorSheet
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        value="PHP"
        trigger={<button type="button">Currency</button>}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("fintr-sheet-bottom");
    expect(dialog.className).toContain("transition-none");

    fireEvent.click(
      screen.getByRole("button", { name: /USD United States dollar/i }),
    );

    expect(document.getElementById("fintr-sheet-motion")).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith("USD");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
