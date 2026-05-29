"use client";

import { cn } from "@/lib/utils";

export const FINTR_LOGO_LIGHT_SRC =
  "https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png";

/** Wordmark tinted with `--primary-dark-mode` (oklch 0.93 / ~#E8EDF6). */
export const FINTR_LOGO_DARK_SRC = "/fintr-logo-dark.png";

interface FintrLogoProps {
  className?: string;
}

export function FintrLogo({ className = "h-8 w-auto" }: FintrLogoProps) {
  return (
    <>
      <img
        src={FINTR_LOGO_LIGHT_SRC}
        alt="Fintr Logo"
        className={cn(className, "dark:hidden")}
      />
      <img
        src={FINTR_LOGO_DARK_SRC}
        alt="Fintr Logo"
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}
