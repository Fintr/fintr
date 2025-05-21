"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

const DynamicTransactionsTab = dynamic(
  () => import("@/components/dashboard/tabs/transactions-tab"),
  {
    ssr: false,
  }
);

export default function page() {
  return (
    <TabsContent value="transactions">
      <DynamicTransactionsTab />
    </TabsContent>
  );
}
