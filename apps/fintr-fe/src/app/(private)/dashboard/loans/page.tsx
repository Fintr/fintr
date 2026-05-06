"use client";
import LoansTab from "@/components/dashboard/tabs/loans";
import { TabsContent } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="loans">
      <LoansTab />
    </TabsContent>
  );
}

