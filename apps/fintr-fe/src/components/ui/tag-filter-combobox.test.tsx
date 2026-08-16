import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TagFilterComboBox } from "./tag-filter-combobox";
import type { TransactionTag } from "@/types/transactionTagTypes";

const tags: TransactionTag[] = [
  { id: "tag-trip", name: "Trip", color: "#111111" },
  { id: "tag-work", name: "Work", color: "#222222" },
];

describe("TagFilterComboBox", () => {
  beforeAll(() => {
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 40,
        right: 320,
        width: 320,
        height: 40,
        toJSON: () => ({}),
      }) as DOMRect;
  });

  afterEach(() => {
    cleanup();
  });

  it("opens from a picker button and keeps search inside the list", async () => {
    const user = userEvent.setup();

    render(
      <TagFilterComboBox
        tags={tags}
        placeholder="Select tags"
      />,
    );

    expect(screen.queryByPlaceholderText(/search tags/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /select tags/i }));

    expect(screen.getByPlaceholderText(/search tags/i)).toBeVisible();
    expect(screen.getByRole("option", { name: /trip/i })).toBeVisible();
  });

  it("adds a tag without committing the search text as a value", async () => {
    const user = userEvent.setup();
    const onValuesChange = vi.fn();

    render(
      <TagFilterComboBox
        tags={tags}
        placeholder="Select tags"
        values={[]}
        onValuesChange={onValuesChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select tags/i }));
    await user.type(screen.getByPlaceholderText(/search tags/i), "Trip");

    expect(onValuesChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("option", { name: /trip/i }));

    expect(onValuesChange).toHaveBeenCalledWith(["tag-trip"]);
  });

  it("closes the list when the trigger is clicked again", async () => {
    const user = userEvent.setup();

    render(
      <TagFilterComboBox
        tags={tags}
        placeholder="Select tags"
      />,
    );

    const trigger = screen.getByRole("button", { name: /select tags/i });
    await user.click(trigger);
    expect(screen.getByPlaceholderText(/search tags/i)).toBeVisible();

    await user.click(trigger);
    expect(screen.queryByRole("option", { name: /trip/i })).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
