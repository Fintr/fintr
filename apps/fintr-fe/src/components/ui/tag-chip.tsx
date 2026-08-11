import React from "react";
import { cn } from "@/lib/utils";
import type { TransactionTag } from "@/types/transactionTagTypes";
import { TAG_BANNER_HEIGHT } from "@/utils/tagBanner";

type TagChipProps = {
  tag: Pick<TransactionTag, "name" | "color" | "styleImageUrl">;
  className?: string;
  showDefaultBadge?: boolean;
  variant?: "compact" | "full" | "banner";
};

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  className,
  showDefaultBadge = false,
  variant = "compact",
}) => {
  const backgroundColor = tag.color ?? "#0A3D62";
  const isBanner = variant === "banner";

  if (isBanner) {
    return (
      <div
        className={cn(
          "relative flex w-full overflow-hidden rounded-full",
          "border border-border/60 bg-card shadow-sm",
          className,
        )}
        style={{ height: TAG_BANNER_HEIGHT }}
        title={tag.name}
        aria-label={tag.name}
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

        <div className="flex w-1/2 min-w-0 items-center gap-1.5 px-3 pr-10">
          <p
            className="min-w-0 flex-1 truncate text-left text-xs font-semibold leading-none"
            style={{ color: backgroundColor }}
          >
            {showDefaultBadge ? (
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Default
              </span>
            ) : null}
            {tag.name}
          </p>
        </div>
      </div>
    );
  }

  if (tag.styleImageUrl) {
    return (
      <span
        className={cn(
          "inline-flex h-5 max-w-full items-center overflow-hidden rounded-full border border-border/50",
          className,
        )}
        title={tag.name}
      >
        <span
          className="relative h-full w-6 shrink-0 overflow-hidden bg-muted"
          style={{
            clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tag.styleImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span
          className="whitespace-nowrap px-2 py-0.5 text-[11px] font-medium"
          style={{ color: backgroundColor }}
        >
          {showDefaultBadge ? (
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
              Default
            </span>
          ) : null}
          {tag.name}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      style={{
        backgroundColor: `${backgroundColor}20`,
        color: backgroundColor,
      }}
      title={tag.name}
    >
      {showDefaultBadge ? (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
          Default
        </span>
      ) : null}
      {tag.name}
    </span>
  );
};
