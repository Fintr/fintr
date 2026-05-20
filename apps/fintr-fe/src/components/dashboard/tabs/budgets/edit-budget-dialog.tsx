import { CustomModal } from "@/components/ui/custom-modal";
import { BudgetCategory, BudgetsPage } from "@/types/budgetTypes";
import EditButton from "@/components/ui/edit-button";
import { useState } from "react";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { EditBudgetForm } from "./edit-budget-form";

export function EditBudgetDialog({
  budget,
  budgetsData,
  updateBudgetMutation,
  createBudgetMutation,
  budgetMonthDate,
  spaceCurrency = "PHP",
}: {
  budget: BudgetCategory;
  budgetsData?: BudgetsPage;
  updateBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["updateBudgetMutation"];
  createBudgetMutation?: ReturnType<
    typeof useBudgetsData
  >["createBudgetMutation"];
  budgetMonthDate?: string;
  spaceCurrency?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
  };

  if (!createBudgetMutation || !budgetMonthDate) {
    return <EditButton onClick={() => handleDialogOpenChange(true)} />;
  }

  return (
    <>
      <EditButton onClick={() => handleDialogOpenChange(true)} />
      <CustomModal
        isOpen={dialogOpen}
        onClose={() => handleDialogOpenChange(false)}
        title="Edit Budget"
        maxWidth="lg"
        className="p-0"
      >
        <div className="px-6 pb-6">
          {dialogOpen ? (
            <EditBudgetForm
              budget={budget}
              budgetsData={budgetsData}
              updateBudgetMutation={updateBudgetMutation}
              createBudgetMutation={createBudgetMutation}
              budgetMonthDate={budgetMonthDate}
              spaceCurrency={spaceCurrency}
              onCancel={() => handleDialogOpenChange(false)}
              onSuccess={() => handleDialogOpenChange(false)}
            />
          ) : null}
        </div>
      </CustomModal>
    </>
  );
}
