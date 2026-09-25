import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportRecordEditor } from "./import-record-editor";

const updateMutateAsync = vi.fn();

vi.mock("@/hooks/async/useImport", () => ({
  useUpdateImportRecord: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
  useImportSingleRecord: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

vi.mock("@/components/dashboard/forms/GridPicker", () => ({
  default: () => <div>Category picker</div>,
}));

vi.mock("@/components/dashboard/forms/TransactionEntityField", () => ({
  default: ({
    kind,
    value,
    onChange,
  }: {
    kind: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {kind === "payer" ? "Payer" : "Merchant"}
      <input
        aria-label={kind === "payer" ? "Payer" : "Merchant"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}));

describe("ImportRecordEditor", () => {
  beforeEach(() => {
    updateMutateAsync.mockReset();
    updateMutateAsync.mockResolvedValue({});
  });

  it("saves the merchant with the edited import row", async () => {
    const user = userEvent.setup();

    render(
      <ImportRecordEditor
        importId="import-1"
        importRecordId="record-1"
        initialData={{
          date: "2024-01-15",
          description: "Groceries",
          amount: 100,
          type: "expense",
          category: "Food",
          merchant: "SM",
        }}
        onCancel={() => undefined}
        onImported={() => undefined}
      />,
    );

    const merchantInput = screen.getByRole("textbox", { name: "Merchant" });
    expect(merchantInput).toHaveValue("SM");

    await user.clear(merchantInput);
    await user.type(merchantInput, "Jollibee");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant: "Jollibee",
        }),
      }),
    );
  });
});
