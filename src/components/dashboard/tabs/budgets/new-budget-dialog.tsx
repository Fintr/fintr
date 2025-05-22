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
import { transformBudgetsToCategories } from "@/services/budgets/queries";
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
const formSchema = z.object({
  category: z.string(),
  amount: z.coerce.number(),
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

  const categories = budgetsData?.budgets
    ? transformBudgetsToCategories(budgetsData.budgets)
    : [];

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("VALUES ", values);
    createBudgetMutation.mutate({
      budgetCategory: values.category,
      budgetAmount: values.amount,
    });
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="myself">Myself</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="home">Home</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="pet">Pet</SelectItem>
                        <SelectItem value="subscriptions">
                          Subscriptions
                        </SelectItem>
                        <SelectItem value="going-out">Going Out</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="shopping">Shopping</SelectItem>
                        {customExpenseCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
