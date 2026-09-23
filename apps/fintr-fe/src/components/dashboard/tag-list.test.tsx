import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

import TagList from "./tag-list";
import type { TransactionTag } from "@/types/transactionTagTypes";

vi.mock("./tag-form-dialog", () => ({
  default: () => null,
}));

const japanTag: TransactionTag = {
  id: "tag-japan",
  name: "Japan 2026",
  color: "#0A3D62",
  isDefault: false,
};

describe("TagList delete confirmation", () => {
  it("asks for confirmation before deleting a tag", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <TagList
        tags={[japanTag]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        onToggleDefault={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete japan 2026/i }));

    expect(
      screen.getByRole("heading", { name: /delete tag/i }),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <TagList
        tags={[japanTag]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        onToggleDefault={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete japan 2026/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes after confirmation and mentions transaction assignments", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <TagList
        tags={[japanTag]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        onToggleDefault={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete japan 2026/i }));

    expect(screen.getByText(/remove it from all transactions/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete tag$/i }));

    expect(onDelete).toHaveBeenCalledWith("tag-japan");
  });
});
