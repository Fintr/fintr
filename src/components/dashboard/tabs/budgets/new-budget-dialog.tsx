import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Budget, BudgetsPage } from "@/types/budgetTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { ComboBox } from "@/components/ui/combobox";
import { OptionType } from "@/types/generalTypes";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";

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
}: {
  budgetsData?: BudgetsPage;
  createBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["createBudgetMutation"];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<
    string[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get expense categories from dashboard data
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      amount: 0,
    },
  });

  // Use categories from dashboard data instead of hardcoded ones
  const allCategoryOptions: OptionType[] = [
    ...expenseCategoryOptions,
    ...customExpenseCategories.map((cat) => ({ value: cat, label: cat })),
  ];

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

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setFieldErrors({}); // Clear previous errors
    
    // Auto-supply today's date
    const today = new Date().toISOString().split("T")[0];
    
    createBudgetMutation.mutate(
      {
        categoryName: values.category,
        amount: values.amount,
        date: today,
      },
      {
        onSuccess: () => {
          // Add to custom categories if it's not in expense options and not already custom
          if (
            !expenseCategoryOptions.find((pc) => pc.value === values.category) &&
            !customExpenseCategories.includes(values.category)
          ) {
            setCustomExpenseCategories((prev) => [...prev, values.category]);
          }
          form.reset();
          setDialogOpen(false); // Only close on success
          setIsSubmitting(false);
        },
        onError: (error) => {
          console.error('Budget creation error:', error);
          const errors = extractFieldErrors(error);
          setFieldErrors(errors);
          setIsSubmitting(false);
          // Don't close dialog on error - let user fix and retry
        },
      }
    );
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

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Budget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <ComboBox
                      filterType="frontend"
                      data={allCategoryOptions}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        // Clear category error when user changes selection
                        if (fieldErrors.category) {
                          setFieldErrors(prev => ({ ...prev, category: undefined }));
                        }
                      }}
                      placeholder="Select or create category"
                      renderNotFound={(searchValue, selectValueAndClose) => (
                        <Button
                          variant="ghost"
                          className="w-full justify-start p-2 h-auto"
                          onClick={() => {
                            field.onChange(searchValue); // Set the form value
                            // Clear category error when user changes selection
                            if (fieldErrors.category) {
                              setFieldErrors(prev => ({ ...prev, category: undefined }));
                            }
                          }}
                        >
                          Create "{searchValue}" budget category
                        </Button>
                      )}
                    />
                  </FormControl>
                  <FormMessage>
                    {getCategoryErrorMessage() || form.formState.errors.category?.message}
                  </FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        // Clear amount error when user changes value
                        if (fieldErrors.amount) {
                          setFieldErrors(prev => ({ ...prev, amount: undefined }));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage>
                    {getAmountErrorMessage() || form.formState.errors.amount?.message}
                  </FormMessage>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
