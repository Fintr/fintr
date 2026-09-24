"use client";

import { TabsContent } from "@/components/ui/tabs";
import HomeTab from "@/components/dashboard/tabs/home";

export default function page() {
  return (
    <TabsContent value="home" className="min-h-0 p-0 md:p-2">
      <HomeTab />
    </TabsContent>
  );
}
