import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

import { TAG_STYLE_PRESETS } from "@/lib/tags/preset-style-images";
import { TagPresetStylePicker } from "./tag-preset-style-picker";

describe("TagPresetStylePicker", () => {
  it("renders every sample image as a choice", () => {
    render(
      <TagPresetStylePicker
        selectedKey={undefined}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /^use .* sample$/i }),
    ).toHaveLength(TAG_STYLE_PRESETS.length);
    expect(
      screen.getByRole("button", { name: /use japan vacation sample/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use vacation sample/i }),
    ).toBeInTheDocument();
  });

  it("highlights the selected sample", () => {
    render(
      <TagPresetStylePicker
        selectedKey="japan-vacation"
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /use japan vacation sample/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect with the preset key", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TagPresetStylePicker
        selectedKey={undefined}
        onSelect={onSelect}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /use vacation sample/i }),
    );

    expect(onSelect).toHaveBeenCalledWith("europe-vacation");
  });
});
