"use client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab";

export default function CategoriesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-2 pb-24 md:pb-4">
      <div className="max-w-7xl mx-auto">
        <SpaceSettingsTab initialTab="categories" hideTabs={true} />
      </div>
    </div>
  );
}

