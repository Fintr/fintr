"use client";

import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab";

export default function TagsPage() {
  return (
    <div className="min-h-screen bg-background p-2 pb-24 md:pb-4">
      <div className="mx-auto max-w-7xl">
        <SpaceSettingsTab initialTab="tags" hideTabs />
      </div>
    </div>
  );
}
