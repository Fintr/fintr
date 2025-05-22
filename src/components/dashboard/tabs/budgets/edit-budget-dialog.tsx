import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Budget, BudgetCategory, BudgetsPage } from "@/types/budgetTypes";
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
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
const formSchema = z.object({
  category: z.string(),
  amount: z.coerce.number(),
});

export function EditBudgetDialog({
  budget,
  updateBudgetMutation,
}: {
  budget: BudgetCategory;
  updateBudgetMutation: ReturnType<
    typeof useBudgetsData
  >["updateBudgetMutation"];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<
    string[]
  >([]);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: budget.name,
      amount: budget.budget,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateBudgetMutation.mutate({
      budgetId: budget.id,
      data: { amount: values.amount },
    });
    setDialogOpen(false);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
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
                        <SelectItem value="Myself">Myself</SelectItem>
                        <SelectItem value="Family">Family</SelectItem>
                        <SelectItem value="Insurance">Insurance</SelectItem>
                        <SelectItem value="Home">Home</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                        <SelectItem value="Food">Food</SelectItem>
                        <SelectItem value="Transport">Transport</SelectItem>
                        <SelectItem value="Pet">Pet</SelectItem>
                        <SelectItem value="Subscriptions">
                          Subscriptions
                        </SelectItem>
                        <SelectItem value="Going Out">Going Out</SelectItem>
                        <SelectItem value="Travel">Travel</SelectItem>
                        <SelectItem value="Shopping">Shopping</SelectItem>
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
