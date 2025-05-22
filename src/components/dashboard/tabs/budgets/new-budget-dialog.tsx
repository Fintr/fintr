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

const formSchema = z.object({
  category: z.string().min(1, { message: "Category cannot be empty." }),
  amount: z.coerce.number().min(1, { message: "Amount must be greater than 0." }),
});

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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      amount: 0,
    },
  });

  const predefinedCategories: OptionType[] = [
    { value: "myself", label: "Myself" },
    { value: "family", label: "Family" },
    { value: "insurance", label: "Insurance" },
    { value: "home", label: "Home" },
    { value: "utilities", label: "Utilities" },
    { value: "food", label: "Food" },
    { value: "transport", label: "Transport" },
    { value: "pet", label: "Pet" },
    { value: "subscriptions", label: "Subscriptions" },
    { value: "going-out", label: "Going Out" },
    { value: "travel", label: "Travel" },
    { value: "shopping", label: "Shopping" },
  ];

  const allCategoryOptions: OptionType[] = [
    ...predefinedCategories,
    ...customExpenseCategories.map((cat) => ({ value: cat, label: cat })),
  ];


  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("VALUES ", values);
    createBudgetMutation.mutate({
      budgetCategory: values.category,
      budgetAmount: values.amount,
    });
    // Add to custom categories if it's not predefined and not already custom
    if (
      !predefinedCategories.find((pc) => pc.value === values.category) &&
      !customExpenseCategories.includes(values.category)
    ) {
      setCustomExpenseCategories((prev) => [...prev, values.category]);
    }
    form.reset();
    setDialogOpen(false);
  }

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
                      }}
                      placeholder="Select or create category"
                      renderNotFound={(searchValue, selectValueAndClose) => (
                        <Button
                          variant="ghost"
                          className="w-full justify-start p-2 h-auto"
                          onClick={() => {
                            field.onChange(searchValue); // Set the form value
                            // No need to call selectValueAndClose if it closes the popover automatically
                            // The combobox will close once an item is selected or focus is lost.
                            // For this button, we want the user to confirm the action.
                            // We can consider adding the new category to customExpenseCategories here
                            // or rely on the onSubmit logic to do so.
                            // For now, let it be handled by onSubmit to keep consistency.
                          }}
                        >
                          Create "{searchValue}" budget category
                        </Button>
                      )}
                    />
                  </FormControl>
                  <FormMessage />
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
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Confirm</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
