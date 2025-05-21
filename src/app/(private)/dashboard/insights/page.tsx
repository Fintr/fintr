"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InsightsTab from "@/components/dashboard/tabs/insights-tab";

export default function page() {
  return (
    <TabsContent value="insights">
      <InsightsTab />
    </TabsContent>
  );
}
