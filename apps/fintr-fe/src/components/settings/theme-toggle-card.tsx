"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { applyThemeWithNativeSync } from "@/lib/sync-theme-to-native";
import { cn } from "@/lib/utils";

const cardClassName = cn(
  "bg-primary/10 dark:bg-card text-primary",
  "rounded-lg p-4 md:p-6",
  "h-full w-full",
  "flex flex-col items-center justify-center",
  "gap-3",
  "shadow-sm",
  "border border-transparent",
  "cursor-pointer transition-all",
  "hover:shadow-md hover:scale-[1.02] hover:border-primary/20",
);

export function ThemeToggleCard() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    applyThemeWithNativeSync(setTheme, isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      className={cardClassName}
      onClick={toggleTheme}
      disabled={!mounted}
      aria-label={
        mounted
          ? isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
          : "Appearance"
      }
    >
      {isDark ? (
        <Moon className="h-8 w-8 md:h-10 md:w-10" aria-hidden />
      ) : (
        <Sun className="h-8 w-8 md:h-10 md:w-10" aria-hidden />
      )}
      <span className="text-center text-xs font-medium md:text-sm">
        {mounted ? (isDark ? "Dark Mode" : "Light Mode") : "Appearance"}
      </span>
      {mounted ? (
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => {
            applyThemeWithNativeSync(setTheme, checked ? "dark" : "light");
          }}
          onClick={(event) => event.stopPropagation()}
          aria-hidden
          tabIndex={-1}
        />
      ) : (
        <div className="h-[1.15rem] w-8" aria-hidden />
      )}
    </button>
  );
}
