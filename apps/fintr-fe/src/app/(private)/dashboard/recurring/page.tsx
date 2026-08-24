"use client";
import { TabsContent } from "@/components/ui/tabs";
import RecurringTab from "@/components/dashboard/tabs/recurring";

export default function RecurringPage() {
  return (
    <TabsContent value="recurring" className="p-2">
      <RecurringTab />
    </TabsContent>
  );
}
