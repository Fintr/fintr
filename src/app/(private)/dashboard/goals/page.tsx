"use client";
import GoalSection from "@/components/dashboard/goals-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="goals">
      <GoalSection />
    </TabsContent>
  );
}
