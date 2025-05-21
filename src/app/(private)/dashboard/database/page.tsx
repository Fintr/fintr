"use client";
import DatabaseTab from "@/components/dashboard/tabs/database-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="database">
      <DatabaseTab />
    </TabsContent>
  );
}
