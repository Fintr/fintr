"use client";
import BudgetsTab from "@/components/dashboard/tabs/budgets-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="budgets">
      <BudgetsTab />
    </TabsContent>
  );
}
