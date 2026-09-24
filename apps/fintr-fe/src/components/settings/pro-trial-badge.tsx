"use client";

import { Badge } from "@/components/ui/badge";
import { useProAccess } from "@/hooks/async/useProAccess";
import { cn } from "@/lib/utils";

export function ProTrialBadge({ className }: { className?: string }) {
  const { data } = useProAccess();

  if (data?.source !== "trial") {
    return null;
  }

  return (
    <Badge
      aria-hidden="true"
      className={cn(
        "px-1.5 pb-0 pt-[0.3em] text-[10px] font-semibold uppercase leading-none tracking-wide",
        className,
      )}
    >
      Pro
    </Badge>
  );
}
