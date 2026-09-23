import { useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MerchantPicker } from "./merchant-picker";

const pickerProps = {
  label: "Borrower",
  placeholder: "Select borrower",
  title: "Select Borrower",
  searchPlaceholder: "Search borrowers…",
  emptyTitle: "No borrowers yet",
  emptyDescription: "Save people you lend to.",
  addLabel: "Create borrower",
  notFoundPrefix: "No borrower matches",
  createLabel: (name: string) => `Add "${name}"`,
  onAddMerchant: vi.fn(),
  onQuickCreate: vi.fn(),
  onOpenCreationPanel: vi.fn(),
};

const borrowers = [
  { id: "1", fullName: "Miko2" },
  { id: "2", fullName: "Jerry Oquendo" },
];

describe("MerchantPicker", () => {
  it("keeps borrowers searchable when the fetch callback is recreated each render", async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [, setTick] = useState(0);

      useEffect(() => {
        const id = window.setInterval(() => {
          setTick((current) => current + 1);
        }, 20);
        return () => window.clearInterval(id);
      }, []);

      return (
        <MerchantPicker
          {...pickerProps}
          value=""
          onChange={vi.fn()}
          onFetchMerchants={async (query) => {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 40);
            });
            const needle = query.trim().toLowerCase();
            return borrowers.filter((borrower) =>
              borrower.fullName.toLowerCase().includes(needle),
            );
          }}
        />
      );
    };

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Select borrower" }));
    expect(await screen.findByRole("button", { name: "Miko2" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search borrowers…"), "jer");
    expect(await screen.findByRole("button", { name: "Jerry Oquendo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Miko2" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
