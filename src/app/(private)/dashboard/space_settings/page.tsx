"use client";
import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function page() {
  return (
    <TabsContent value="space_settings">
      <SpaceSettingsTab />
    </TabsContent>
  );
}
