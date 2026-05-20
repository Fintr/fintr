import { Button } from "@/components/ui/button";
import { BudgetCategory, BudgetsPage, CreateBudgetPayload } from "@/types/budgetTypes";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { useEffect, useMemo, useState } from "react";
import { useNumberInput } from "@/hooks/useNumberInput";
import { formatCurrency, numberFormatting } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import GridPicker from "@/components/dashboard/forms/GridPicker";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import {
  buildBudgetAllocationContext,
  firstDayOfMonth,
  formatBudgetAllocationHint,
  isBudgetOverAllocation,
  isSubcategoryTotalOverParent,
  mergeSubcategoryBudgetLines,
  SubcategoryBudgetLine,
  sumSubcategoryBudgetLines,
} from "@/utils/budgetAllocation";
import { formatCategoryPickerValue } from "@/types/categoryTreeTypes";
import { BudgetAllocationSummary } from "./budget-allocation-summary";

const formSchema = z.object({
  category: z.string(),
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0." }),
});

const categoryPickerValueForBudget = (budget: BudgetCategory): string => {
  if (budget.isSubcategoryBudget && budget.categoryId && budget.subcategoryId) {
    return formatCategoryPickerValue({
      categoryId: budget.categoryId,
      subcategoryId: budget.subcategoryId,
    });
  }

  if (budget.categoryId) {
    return formatCategoryPickerValue({
      categoryId: budget.categoryId,
      subcategoryId: null,
    });
  }

  return budget.name;
};

export type EditBudgetFormProps = {
  budget: BudgetCategory;
  budgetsData?: BudgetsPage;
  updateBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["updateBudgetMutation"];
  createBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["createBudgetMutation"];
  budgetMonthDate: string;
  spaceCurrency?: string;
  hideCategory?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function EditBudgetForm({
  budget,
  budgetsData,
  updateBudgetMutation,
  createBudgetMutation,
  budgetMonthDate,
  spaceCurrency = "PHP",
  hideCategory = false,
  onCancel,
  onSuccess,
}: EditBudgetFormProps) {
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcategoryLines, setSubcategoryLines] = useState<SubcategoryBudgetLine[]>(
    [],
  );
  const [subDisplayValues, setSubDisplayValues] = useState<Record<string, string>>(
    {},
  );

  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const categoryValue = categoryPickerValueForBudget(budget);
  const isSubcategoryBudget = Boolean(budget.isSubcategoryBudget);
  const isCreateMode = !budget.id;

  const parentCategoryOption = useMemo(
    () =>
      budget.categoryId
        ? expenseCategoryOptions.find((option) => option.id === budget.categoryId)
        : undefined,
    [budget.categoryId, expenseCategoryOptions],
  );

  const hasSubcategoryChildren = Boolean(
    !isSubcategoryBudget && (parentCategoryOption?.children?.length ?? 0) > 0,
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: categoryValue,
      amount: budget.budget,
    },
  });

  const amountInput = useNumberInput({
    initialValue: budget.budget,
    onValueChange: (cleanValue) => {
      form.setValue("amount", cleanValue, { shouldValidate: true });
    },
  });

  const watchedAmount = form.watch("amount");

  const allocatedToSubs = useMemo(
    () => sumSubcategoryBudgetLines(subcategoryLines),
    [subcategoryLines],
  );

  const allocationContext = useMemo(
    () =>
      buildBudgetAllocationContext({
        categoryValue,
        amount: watchedAmount || 0,
        budgetsData,
        exclude: {
          budgetId: budget.id || undefined,
          subcategoryId: budget.subcategoryId ?? undefined,
        },
      }),
    [categoryValue, watchedAmount, budgetsData, budget.id, budget.subcategoryId],
  );

  const allocationHint = useMemo(() => {
    if (hasSubcategoryChildren || !allocationContext) {
      return null;
    }

    return formatBudgetAllocationHint(
      allocationContext,
      spaceCurrency,
      formatCurrency,
    );
  }, [hasSubcategoryChildren, allocationContext, spaceCurrency]);

  const isOverAllocation = useMemo(() => {
    if (hasSubcategoryChildren) {
      return isSubcategoryTotalOverParent(watchedAmount || 0, subcategoryLines);
    }

    return isBudgetOverAllocation(allocationContext, watchedAmount || 0);
  }, [
    hasSubcategoryChildren,
    watchedAmount,
    subcategoryLines,
    allocationContext,
  ]);

  const initializeSubcategoryLines = () => {
    const children =
      parentCategoryOption?.children?.map((child) => ({
        id: child.id,
        label: child.label,
      })) ?? [];

    const lines = mergeSubcategoryBudgetLines(children, budget.subcategories);
    setSubcategoryLines(lines);
    setSubDisplayValues(
      Object.fromEntries(
        lines.map((line) => [
          line.subcategoryId,
          line.amount > 0
            ? numberFormatting.formatForInput(line.amount.toString())
            : "",
        ]),
      ),
    );
  };

  useEffect(() => {
    form.reset({
      category: categoryValue,
      amount: budget.budget,
    });
    amountInput.setDisplayValue(
      numberFormatting.formatForInput(budget.budget.toString()),
    );
    setAllocationMessage(null);
    setIsSubmitting(false);

    if (hasSubcategoryChildren) {
      initializeSubcategoryLines();
    }
  }, [budget.id, budget.budget, budget.subcategories, categoryValue]);

  const handleSubAmountChange = (subcategoryId: string, displayValue: string) => {
    const amount = numberFormatting.cleanForBackend(displayValue);

    setSubDisplayValues((prev) => ({
      ...prev,
      [subcategoryId]: displayValue,
    }));
    setSubcategoryLines((prev) =>
      prev.map((line) =>
        line.subcategoryId === subcategoryId
          ? { ...line, amount }
          : line,
      ),
    );
    setAllocationMessage(null);
  };

  const persistSubcategoryBudgets = async (
    parentAmount: number,
    lines: SubcategoryBudgetLine[],
  ) => {
    if (!budget.categoryId || !budgetMonthDate) {
      return;
    }

    for (const line of lines) {
      if (line.amount < 1) {
        continue;
      }

      if (line.budgetId) {
        await updateBudgetMutation.mutateAsync({
          budgetId: line.budgetId,
          data: { amount: line.amount },
        });
        continue;
      }

      const payload: CreateBudgetPayload = {
        categoryId: budget.categoryId,
        subcategoryId: line.subcategoryId,
        amount: line.amount,
        date: firstDayOfMonth(budgetMonthDate),
      };

      await createBudgetMutation.mutateAsync(payload);
    }
  };

  async function onSubmit() {
    if (isOverAllocation) {
      setAllocationMessage(
        allocationHint ?? "Subcategory budgets cannot exceed the parent budget.",
      );
      return;
    }

    const amount = numberFormatting.cleanForBackend(amountInput.displayValue);

    if (amount < 1) {
      return;
    }

    setIsSubmitting(true);
    setAllocationMessage(null);

    try {
      if (isCreateMode) {
        if (!budget.categoryId) {
          return;
        }

        await createBudgetMutation.mutateAsync({
          categoryId: budget.categoryId,
          amount,
          date: firstDayOfMonth(budgetMonthDate),
        });

        if (hasSubcategoryChildren) {
          await persistSubcategoryBudgets(amount, subcategoryLines);
        }
      } else {
        await updateBudgetMutation.mutateAsync({
          budgetId: budget.id,
          data: { amount },
        });

        if (hasSubcategoryChildren) {
          await persistSubcategoryBudgets(amount, subcategoryLines);
        }
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving budget:", error);
      setAllocationMessage(
        "Could not save budget. Subcategory totals must stay within the parent amount.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!hideCategory && (
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <GridPicker
                    pickerKind="category"
                    label="Category"
                    value={field.value}
                    onChange={field.onChange}
                    categories={expenseCategoryOptions}
                    categoryType={CategoryTypeEnum.EXPENSE}
                    disabled
                    allowInlineCreate={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="amount"
          render={() => (
            <FormItem>
              <FormLabel>
                {hasSubcategoryChildren ? "Parent budget" : "Amount"}
              </FormLabel>
              <FormControl>
                <CalculatorInput
                  id={`edit-budget-amount-${budget.id || budget.categoryId}`}
                  placeholder="0.00"
                  value={amountInput.displayValue}
                  onChange={(value) => {
                    amountInput.handleInputChange(value);
                    setAllocationMessage(null);
                  }}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasSubcategoryChildren && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium text-primary">
              Subcategory budgets
            </p>
            <p className="text-xs text-muted-foreground">
              Allocate amounts to each subcategory. The total cannot exceed the
              parent budget.
            </p>
            <div className="space-y-3">
              {subcategoryLines.map((line) => (
                <div key={line.subcategoryId} className="space-y-1">
                  <FormLabel htmlFor={`sub-budget-${line.subcategoryId}`}>
                    {line.subcategoryName}
                  </FormLabel>
                  <CalculatorInput
                    id={`sub-budget-${line.subcategoryId}`}
                    placeholder="0.00"
                    value={subDisplayValues[line.subcategoryId] ?? ""}
                    onChange={(value) =>
                      handleSubAmountChange(line.subcategoryId, value)
                    }
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {allocationMessage && (
          <p className="text-sm text-red-600">{allocationMessage}</p>
        )}
        {hasSubcategoryChildren && !allocationMessage && (
          <BudgetAllocationSummary
            parentAmount={watchedAmount || 0}
            allocatedToSubs={allocatedToSubs}
            spaceCurrency={spaceCurrency}
            isOverAllocation={isOverAllocation}
          />
        )}
        {!hasSubcategoryChildren && allocationHint && !allocationMessage && (
          <p
            className={
              isOverAllocation
                ? "text-sm text-red-600"
                : "text-sm text-muted-foreground"
            }
          >
            {allocationHint}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            className={onCancel ? "flex-1" : "w-full"}
            disabled={isSubmitting || isOverAllocation}
          >
            {isSubmitting
              ? "Saving..."
              : isCreateMode
                ? "Set budget"
                : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
