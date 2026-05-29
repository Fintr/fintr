"use client";
import BudgetsTab from "@/components/dashboard/tabs/budgets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="budgets" className="p-2">
      <BudgetsTab />
    </TabsContent>
  );
}
