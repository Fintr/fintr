import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BudgetsPage } from "@/types/budgetTypes";
import { CategoryTypeEnum } from "@/types/categoryTypes";
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
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNumberInput } from "@/hooks/useNumberInput";
import { formatCurrency, numberFormatting } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import { AxiosInstance } from "axios";
import GridPicker from "@/components/dashboard/forms/GridPicker";
import { filterCategoryOptionsWithoutBudgets } from "@/services/budgets/queries";
import {
  getCategoryDisplayLabel,
  getCategoryTriggerDisplay,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import {
  buildBudgetAllocationContext,
  firstDayOfMonth,
  formatBudgetAllocationHint,
  isBudgetOverAllocation,
} from "@/utils/budgetAllocation";
import { useSpaceContext } from "@/hooks/useSpaceContext";

const formSchema = z.object({
  category: z.string().min(1, { message: "Category cannot be empty." }),
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0." }),
});

interface FieldErrors {
  category?: string[];
  amount?: string[];
}

type AddBudgetStep = "idle" | "category" | "amount";

export function NewBudgetDialog({
  budgetsData,
  createBudgetMutation,
  api,
  budgetMonthDate,
}: {
  budgetsData?: BudgetsPage;
  createBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["createBudgetMutation"];
  api: AxiosInstance;
  budgetMonthDate: string;
}) {
  const [step, setStep] = useState<AddBudgetStep>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);

  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  const availableCategoryOptions = useMemo(
    () =>
      filterCategoryOptionsWithoutBudgets(
        expenseCategoryOptions,
        budgetsData?.budgets as Array<Record<string, unknown>> | undefined,
      ),
    [expenseCategoryOptions, budgetsData?.budgets],
  );

  const hasAvailableCategories = availableCategoryOptions.length > 0;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      amount: 0,
    },
  });

  const amountInput = useNumberInput({
    onValueChange: (cleanValue) => {
      form.setValue("amount", cleanValue, { shouldValidate: true });
    },
  });

  const watchedCategory = form.watch("category");
  const watchedAmount = form.watch("amount");

  const categoryDisplay = useMemo(() => {
    if (!watchedCategory) {
      return null;
    }

    return getCategoryTriggerDisplay(watchedCategory, expenseCategoryOptions);
  }, [watchedCategory, expenseCategoryOptions]);

  const allocationContext = useMemo(
    () =>
      buildBudgetAllocationContext({
        categoryValue: watchedCategory,
        amount: watchedAmount || 0,
        budgetsData,
      }),
    [watchedCategory, watchedAmount, budgetsData],
  );

  const allocationHint = useMemo(() => {
    if (!allocationContext) {
      return null;
    }

    return formatBudgetAllocationHint(
      allocationContext,
      spaceCurrency,
      formatCurrency,
    );
  }, [allocationContext, spaceCurrency]);

  const isOverAllocation = useMemo(
    () => isBudgetOverAllocation(allocationContext, watchedAmount || 0),
    [allocationContext, watchedAmount],
  );

  const resetFlow = () => {
    setStep("idle");
    setFieldErrors({});
    setAllocationMessage(null);
    setIsSubmitting(false);
    form.reset();
    amountInput.reset();
  };

  const extractFieldErrors = (error: unknown): FieldErrors => {
    const parsed: FieldErrors = {};

    try {
      const details = (error as { response?: { data?: { error?: { details?: Record<string, unknown> } } } })
        ?.response?.data?.error?.details;

      if (!details) {
        return parsed;
      }

      if (details.category) {
        parsed.category = details.category as string[];
      }
      if (details.amount) {
        parsed.amount = details.amount as string[];
      }
      if (details.allocation_exceeded) {
        parsed.amount = [String(details.allocation_exceeded)];
      }
      if (details.parent_budget_missing) {
        parsed.category = [String(details.parent_budget_missing)];
      }
    } catch (parseError) {
      console.error("Error parsing field errors:", parseError);
    }

    return parsed;
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isOverAllocation) {
      setAllocationMessage(
        allocationHint ?? "This amount exceeds the available parent budget allocation.",
      );
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setAllocationMessage(null);

    try {
      const assignment = parseCategoryPickerValue(values.category);
      if (!assignment) {
        setFieldErrors({ category: ["Select a category"] });
        setIsSubmitting(false);
        return;
      }

      const amount = numberFormatting.cleanForBackend(amountInput.displayValue);

      if (amount < 1) {
        setFieldErrors({ amount: ["Amount must be greater than 0."] });
        setIsSubmitting(false);
        return;
      }

      await createBudgetMutation.mutateAsync({
        categoryId: assignment.categoryId,
        subcategoryId: assignment.subcategoryId,
        amount,
        date: firstDayOfMonth(budgetMonthDate),
      });

      resetFlow();
    } catch (error) {
      console.error("Error in budget creation flow:", error);
      const errors = extractFieldErrors(error);
      setFieldErrors(errors);
      setIsSubmitting(false);
    }
  }

  const getCategoryErrorMessage = () => {
    if (fieldErrors.category?.length) {
      const errorMessage = fieldErrors.category[0];
      if (errorMessage.includes("must be the only expense category for the month")) {
        return "A budget already exists for this category this month. Please choose a different category.";
      }
      return errorMessage;
    }
    return undefined;
  };

  const getAmountErrorMessage = () => {
    if (fieldErrors.amount?.length) {
      return fieldErrors.amount[0];
    }
    return undefined;
  };

  const handleCategoryPickerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setStep((current) => (current === "category" ? "idle" : current));
    }
  }, []);

  const handleCategorySelected = useCallback(
    (value: string) => {
      form.setValue("category", value, { shouldValidate: true });
      setAllocationMessage(null);
      setFieldErrors((prev) => ({ ...prev, category: undefined }));
      setStep("amount");
    },
    [form],
  );

  const handleStartAddBudget = useCallback(() => {
    form.reset({ category: "", amount: 0 });
    amountInput.reset();
    setFieldErrors({});
    setAllocationMessage(null);
    setStep("category");
  }, [form, amountInput]);

  return (
    <>
      <Button type="button" onClick={handleStartAddBudget}>
        <Plus /> Add Budget
      </Button>

      <GridPicker
        pickerKind="category"
        label="Category"
        hideTrigger
        open={step === "category"}
        modalTitle="New Budget"
        value={watchedCategory}
        onOpenChange={handleCategoryPickerOpenChange}
        onChange={handleCategorySelected}
        categories={availableCategoryOptions}
        placeholder={
          hasAvailableCategories
            ? "Select category"
            : "Add a new category"
        }
        emptyMessage={
          hasAvailableCategories
            ? undefined
            : "All existing categories already have a budget for this period. Add a new category below."
        }
        categoryType={CategoryTypeEnum.EXPENSE}
        onCategoryCreated={handleCategorySelected}
      />

      <Dialog
        open={step === "amount"}
        onOpenChange={(open) => {
          if (!open) {
            resetFlow();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-primary">New Budget</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">Category</p>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  {categoryDisplay?.secondary ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {categoryDisplay.primary}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {categoryDisplay.secondary}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-medium">
                      {getCategoryDisplayLabel(
                        watchedCategory,
                        expenseCategoryOptions,
                      )}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => setStep("category")}
                >
                  Change category
                </Button>
                {getCategoryErrorMessage() && (
                  <p className="text-sm text-red-600">{getCategoryErrorMessage()}</p>
                )}
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={() => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <CalculatorInput
                        id="new-budget-amount"
                        placeholder="0.00"
                        value={amountInput.displayValue}
                        onChange={(value) => {
                          amountInput.handleInputChange(value);
                          setAllocationMessage(null);
                          if (fieldErrors.amount) {
                            setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                          }
                        }}
                        disabled={isSubmitting}
                        className={
                          getAmountErrorMessage() || form.formState.errors.amount?.message
                            ? "border-red-800 focus-visible:ring-red-800"
                            : ""
                        }
                      />
                    </FormControl>
                    {(allocationHint || allocationMessage) && (
                      <p
                        className={
                          isOverAllocation
                            ? "text-sm text-red-600"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        {allocationMessage ?? allocationHint}
                      </p>
                    )}
                    <FormMessage>
                      {getAmountErrorMessage() || form.formState.errors.amount?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || isOverAllocation}
                >
                  {isSubmitting ? "Creating..." : "Confirm"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
