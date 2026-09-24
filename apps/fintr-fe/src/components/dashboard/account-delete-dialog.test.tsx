import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AccountDeleteDialog from "./account-delete-dialog";

const { deleteAccount } = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/async/useAccounts", () => ({
  useAccounts: () => ({
    deleteAccount,
  }),
}));

const account = {
  id: "acct-2",
  name: "Account 2",
} as never;

describe("AccountDeleteDialog", () => {
  beforeEach(() => {
    deleteAccount.mockReset();
    deleteAccount.mockResolvedValue({ success: true });
  });

  it("uses theme-aware text for the quoted account name in dark mode", () => {
    render(
      <AccountDeleteDialog
        account={account}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const description = screen.getByText(/Are you sure you want to delete the account/i);
    expect(description).toHaveClass("text-muted-foreground");

    const accountName = screen.getByText(/"Account 2"/);
    expect(accountName).toHaveClass("text-primary");
    expect(accountName).toHaveClass("dark:text-primary-dark-mode");
    expect(accountName).not.toHaveClass("text-gray-900");
  });

  it("keeps transactions unless the option is checked", async () => {
    const user = userEvent.setup();

    render(
      <AccountDeleteDialog
        account={account}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Account" }));

    expect(deleteAccount).toHaveBeenCalledWith({
      accountId: "acct-2",
      removeTransactions: false,
    });
  });

  it("passes removeTransactions when the option is checked", async () => {
    const user = userEvent.setup();

    render(
      <AccountDeleteDialog
        account={account}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /also remove transactions for this account/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete account and transactions" }),
    );

    expect(deleteAccount).toHaveBeenCalledWith({
      accountId: "acct-2",
      removeTransactions: true,
    });
  });
});
