import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { CategoryAppearancePicker } from "./category-appearance-picker";
import { CATEGORY_ICON_OPTIONS } from "@/utils/categoryAppearance";

describe("CategoryAppearancePicker", () => {
  it("renders all icon options", () => {
    render(
      <CategoryAppearancePicker
        icon="coffee"
        color="#E53935"
        onIconChange={vi.fn()}
        onColorChange={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /^select icon/i }),
    ).toHaveLength(CATEGORY_ICON_OPTIONS.length);
  });

  it("highlights the selected icon", () => {
    render(
      <CategoryAppearancePicker
        icon="coffee"
        color="#E53935"
        onIconChange={vi.fn()}
        onColorChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /select icon coffee/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onIconChange when an icon is selected", async () => {
    const user = userEvent.setup();
    const onIconChange = vi.fn();

    render(
      <CategoryAppearancePicker
        icon="coffee"
        color="#E53935"
        onIconChange={onIconChange}
        onColorChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select icon car/i }));

    expect(onIconChange).toHaveBeenCalledWith("car");
  });

  it("calls onColorChange when a color is selected", async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();

    render(
      <CategoryAppearancePicker
        icon="coffee"
        color="#E53935"
        onIconChange={vi.fn()}
        onColorChange={onColorChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /select color #43A047/i }),
    );

    expect(onColorChange).toHaveBeenCalledWith("#43A047");
  });
});
