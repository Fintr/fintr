"use client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab";

export default function CategoriesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-4 pb-24 md:pb-4">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/space_settings")}
          className="mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            Category Management
          </h1>
          <p className="text-primary/70 text-sm md:text-base">
            Manage your categories for expenses, income, goals, investments, and accounts
          </p>
        </div>
        <SpaceSettingsTab initialTab="categories" hideTabs={true} />
      </div>
    </div>
  );
}

