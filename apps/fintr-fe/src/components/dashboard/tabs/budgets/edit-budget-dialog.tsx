import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BudgetCategory } from "@/types/budgetTypes";
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
import EditButton from "@/components/ui/edit-button";
import { useState } from "react";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import GridPicker from "@/components/dashboard/forms/GridPicker";
import { CategoryTypeEnum } from "@/types/categoryTypes";

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

  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);

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
        <EditButton onClick={() => setDialogOpen(true)} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary">Edit Budget</DialogTitle>
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
