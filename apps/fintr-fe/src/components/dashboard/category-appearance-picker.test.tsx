import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { CategoryAppearancePicker } from "./category-appearance-picker";

describe("CategoryAppearancePicker", () => {
  it("filters icons by search query", async () => {
    const user = userEvent.setup();

    render(
      <CategoryAppearancePicker
        icon="coffee"
        accentColor="#E53935"
        onIconChange={vi.fn()}
      />,
    );

    const searchInput = screen.getByTestId("category-icon-search");
    await user.type(searchInput, "petrol");

    const iconButtons = screen.getAllByRole("button", { name: /^select icon/i });
    const labels = iconButtons.map((button) => button.getAttribute("title"));

    expect(labels).toContain("Fuel");
    expect(labels).toContain("Coffee");
    expect(labels).not.toContain("Tag");
  });

  it("keeps the selected icon visible when it does not match the search", async () => {
    const user = userEvent.setup();

    render(
      <CategoryAppearancePicker
        icon="coffee"
        accentColor="#E53935"
        onIconChange={vi.fn()}
      />,
    );

    await user.type(screen.getByTestId("category-icon-search"), "petrol");

    expect(
      screen.getByRole("button", { name: /select icon coffee/i }),
    ).toBeInTheDocument();
  });

  it("shows the selected icon label", () => {
    render(
      <CategoryAppearancePicker
        icon="shopping-cart"
        accentColor="#E53935"
        onIconChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Selected: Shopping Cart/i)).toBeInTheDocument();
  });

  it("calls onIconChange when an icon is selected", async () => {
    const user = userEvent.setup();
    const onIconChange = vi.fn();

    render(
      <CategoryAppearancePicker
        icon="coffee"
        accentColor="#E53935"
        onIconChange={onIconChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select icon fuel/i }));

    expect(onIconChange).toHaveBeenCalledWith("fuel");
  });
});
