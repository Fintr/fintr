import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import LoanEntityField from "./LoanEntityField";

const mockFetchEntitiesLocalFirst = vi.fn();
const mockCreateEntity = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1"],
}));

vi.mock("@/services/entities/queries", () => ({
  fetchEntitiesLocalFirst: (...args: unknown[]) =>
    mockFetchEntitiesLocalFirst(...args),
}));

vi.mock("@/hooks/async/useEntitiesMutations", () => ({
  useEntitiesMutations: () => ({
    createEntity: (...args: unknown[]) => mockCreateEntity(...args),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/ui/merchant-picker", () => ({
  MerchantPicker: ({
    label,
    placeholder,
    value,
    onChange,
    onAddMerchant,
  }: {
    label?: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    onAddMerchant: () => void;
  }) => (
    <div>
      <span>{label}</span>
      <button type="button" onClick={() => onChange("Selected Lender")}>
        {value || placeholder}
      </button>
      <button type="button" onClick={onAddMerchant}>open-add</button>
    </div>
  ),
}));

vi.mock("./EntityCreationForm", () => ({
  default: ({
    onSuccess,
    onCancel,
    initialName,
  }: {
    onSuccess: (name: string) => void;
    onCancel?: () => void;
    initialName?: string;
  }) => (
    <div>
      <span>creation-form</span>
      {initialName ? <span>{initialName}</span> : null}
      <button type="button" onClick={() => onSuccess("Created Lender")}>
        save-entity
      </button>
      <button type="button" onClick={() => onCancel?.()}>cancel-entity</button>
    </div>
  ),
}));

describe("LoanEntityField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEntitiesLocalFirst.mockResolvedValue([]);
  });

  it("shows lender copy for borrowed loans", () => {
    render(
      <LoanEntityField
        loanType="borrowed"
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Lender")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select lender" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add lender" })).toBeInTheDocument();
  });

  it("shows borrower copy for lent loans", () => {
    render(
      <LoanEntityField
        loanType="lent"
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Borrower")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select borrower" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create borrower" })).toBeInTheDocument();
  });

  it("opens the creation panel and saves a new entity", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LoanEntityField
        loanType="borrowed"
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add lender" }));
    expect(screen.getByText("creation-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select lender" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "save-entity" }));
    expect(onChange).toHaveBeenCalledWith("Created Lender");
    expect(screen.queryByText("creation-form")).not.toBeInTheDocument();
  });
});
