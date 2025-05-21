"use client"
import InvestmentsTab from "@/components/dashboard/tabs/investments-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="investments">
      <InvestmentsTab />
    </TabsContent>
  );
}
