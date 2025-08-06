"use client";
import GoalSection from "@/components/dashboard/goals-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shouldShowV2Features } from "@/lib/utils";

export default function page() {
  const showV2Features = shouldShowV2Features();

  if (!showV2Features) {
    return null; // Or a placeholder/message
  }

  return (
    <TabsContent value="goals">
      <GoalSection />
    </TabsContent>
  );
}
