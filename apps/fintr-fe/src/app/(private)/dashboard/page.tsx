"use client";
import { TabsContent } from "@/components/ui/tabs";
import TransactionsTab from "@/components/dashboard/tabs/transactions/index";

export default function page() {
  return (
    <TabsContent value="transactions" className="p-2">
      <TransactionsTab />
    </TabsContent>
  );
}
