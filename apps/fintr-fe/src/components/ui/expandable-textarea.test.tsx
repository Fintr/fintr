import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpandableTextarea from "./expandable-textarea";

describe("ExpandableTextarea", () => {
  afterEach(() => {
    cleanup();
  });

  it("blurs the field on Enter when blurOnEnterKey is enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExpandableTextarea
        value=""
        onChange={onChange}
        blurOnEnterKey
        aria-label="Notes"
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Notes" });
    const blurSpy = vi.spyOn(textarea, "blur");

    await user.click(textarea);
    await user.keyboard("{Enter}");

    expect(blurSpy).toHaveBeenCalledTimes(1);
    blurSpy.mockRestore();
  });

  it("does not blur on Shift+Enter when blurOnEnterKey is enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExpandableTextarea
        value=""
        onChange={onChange}
        blurOnEnterKey
        aria-label="Notes"
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Notes" });
    const blurSpy = vi.spyOn(textarea, "blur");

    await user.click(textarea);
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(blurSpy).not.toHaveBeenCalled();
    blurSpy.mockRestore();
  });
});
