import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTrigger,
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
import { useMemo, useState } from "react";
import { useNumberInput } from "@/hooks/useNumberInput";
import { numberFormatting } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import { createTransactionCategory } from "@/services/transactions/categories/mutation";
import { AxiosInstance } from "axios";
import GridPicker from "@/components/dashboard/forms/GridPicker";
import { filterCategoryOptionsWithoutBudgets } from "@/services/budgets/queries";

const formSchema = z.object({
  category: z.string().min(1, { message: "Category cannot be empty." }),
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0." }),
});

interface FieldErrors {
  category?: string[];
  amount?: string[];
}

export function NewBudgetDialog({
  budgetsData,
  createBudgetMutation,
  api,  
}: {
  budgetsData?: BudgetsPage;
  createBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["createBudgetMutation"];
  api: AxiosInstance;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);

  const availableCategoryOptions = useMemo(
    () =>
      filterCategoryOptionsWithoutBudgets(
        expenseCategoryOptions,
        budgetsData?.budgets,
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

  const extractFieldErrors = (error: any): FieldErrors => {
    const fieldErrors: FieldErrors = {};
    
    try {
      // Check if error has the expected structure from backend
      if (error?.response?.data?.error?.details) {
        const details = error.response.data.error.details;
        
        // Map backend field names to our form field names
        if (details.category) {
          fieldErrors.category = details.category;
        }
        if (details.amount) {
          fieldErrors.amount = details.amount;
        }
      }
    } catch (e) {
      console.error('Error parsing field errors:', e);
    }
    
    return fieldErrors;
  };

async function onSubmit(values: z.infer<typeof formSchema>) {
  setIsSubmitting(true);
  setFieldErrors({}); // Clear previous errors
  
  try {
    // Step 1: Check if category exists in the current options
    const categoryExists = expenseCategoryOptions.find(
      (cat) => cat.value === values.category,
    );

    if (!categoryExists) {
      await createTransactionCategory(api, {
        name: values.category,
        categoryType: CategoryTypeEnum.EXPENSE,
      });
    }

    const amount = numberFormatting.cleanForBackend(amountInput.displayValue);

    if (amount < 1) {
      setFieldErrors({ amount: ["Amount must be greater than 0."] });
      setIsSubmitting(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    await createBudgetMutation.mutateAsync({
      categoryName: values.category,
      amount,
      date: today,
    });
    
    // Step 4: Success! Reset form and close dialog
    form.reset();
    setDialogOpen(false);
    setIsSubmitting(false);
    
  } catch (error) {
    console.error('Error in budget creation flow:', error);
    
    // Extract and display field-specific errors
    const errors = extractFieldErrors(error);
    setFieldErrors(errors);
    setIsSubmitting(false);
    
    // Don't close dialog on error - let user fix and retry
  }
}

  const getCategoryErrorMessage = () => {
    if (fieldErrors.category && fieldErrors.category.length > 0) {
      // Transform backend error message to be more user-friendly
      const errorMessage = fieldErrors.category[0];
      if (errorMessage.includes("must be the only expense category for the month")) {
        return "A budget already exists for this category this month. Please choose a different category.";
      }
      return errorMessage;
    }
    return undefined;
  };

  const getAmountErrorMessage = () => {
    if (fieldErrors.amount && fieldErrors.amount.length > 0) {
      return fieldErrors.amount[0];
    }
    return undefined;
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);

    if (open) {
      form.reset({ category: "", amount: 0 });
      amountInput.reset();
      setFieldErrors({});
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary">New Budget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      onChange={(value) => {
                        field.onChange(value);
                        if (fieldErrors.category) {
                          setFieldErrors((prev) => ({ ...prev, category: undefined }));
                        }
                      }}
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
                      error={
                        getCategoryErrorMessage()
                          ? [getCategoryErrorMessage() as string]
                          : form.formState.errors.category?.message
                            ? [form.formState.errors.category.message]
                            : undefined
                      }
                      categoryType={CategoryTypeEnum.EXPENSE}
                      onCategoryCreated={(name) => {
                        field.onChange(name);
                        if (fieldErrors.category) {
                          setFieldErrors((prev) => ({ ...prev, category: undefined }));
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
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
                  <FormMessage>
                    {getAmountErrorMessage() || form.formState.errors.amount?.message}
                  </FormMessage>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting || (!hasAvailableCategories && !form.watch("category"))}
              >
                {isSubmitting ? "Creating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
