"use client";

import { cn } from "@/lib/utils";
import type { TransactionTag } from "@/types/transactionTagTypes";

type TagStylePreviewProps = {
  tag: Pick<TransactionTag, "name" | "color" | "styleImageUrl">;
  className?: string;
};

/**
 * Pill preview matching the home travel hint: illustration panel + tag name.
 */
export function TagStylePreview({ tag, className }: TagStylePreviewProps) {
  const backgroundColor = tag.color ?? "#0A3D62";

  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden rounded-full border border-border/60 bg-card shadow-sm",
        className,
      )}
      style={{ height: "calc(5.5rem / 3)" }}
    >
      <div
        className="relative w-1/2 shrink-0 overflow-hidden bg-muted"
        style={{
          clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)",
        }}
      >
        {tag.styleImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tag.styleImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${backgroundColor}55, ${backgroundColor}22)`,
            }}
          />
        )}
      </div>

      <div className="flex flex-1 items-center px-3 pl-4">
        <p
          className="truncate text-xs font-semibold leading-none"
          style={{ color: backgroundColor }}
        >
          {tag.name}
        </p>
      </div>
    </div>
  );
}
