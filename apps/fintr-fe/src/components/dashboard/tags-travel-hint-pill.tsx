"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TagsTravelIllustration } from "@/components/dashboard/tags-travel-illustration";
import type { TransactionTag } from "@/types/transactionTagTypes";
import { TAG_BANNER_HEIGHT } from "@/utils/tagBanner";

/** Pill height was 5.5rem; compact home banner uses one-third. */
const PILL_HEIGHT = TAG_BANNER_HEIGHT;

type TagsTravelHintPillProps = {
  className?: string;
  href?: string;
  defaultTag?: Pick<TransactionTag, "name" | "color" | "styleImageUrl">;
};

/**
 * Home banner pill: default tag when set, otherwise travel hint.
 */
export function TagsTravelHintPill({
  className,
  href = "/dashboard/space_settings/tags",
  defaultTag,
}: TagsTravelHintPillProps) {
  const pill = defaultTag ? (
    <DefaultTagPill tag={defaultTag} className={className} href={href} />
  ) : (
    <TravelHintPill className={className} href={href} />
  );

  if (!href) {
    return pill;
  }

  return (
    <Link
      href={href}
      className="block transition-opacity hover:opacity-90"
    >
      {pill}
    </Link>
  );
}

function TravelHintPill({
  className,
  href,
}: {
  className?: string;
  href?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden rounded-full",
        "border border-border/60 bg-card shadow-sm",
        className,
      )}
      style={{ height: PILL_HEIGHT }}
    >
      <div
        className="relative w-1/2 shrink-0 overflow-hidden bg-[#F5E6D3]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)",
        }}
      >
        <TagsTravelIllustration className="h-full w-full" />
      </div>

      <div className="flex w-1/2 min-w-0 items-center gap-1.5 px-3">
        <p className="flex-1 text-left text-xs font-semibold leading-none text-foreground">
          Traveling?
          <span className="font-normal text-muted-foreground"> Use tags.</span>
        </p>
        {href ? (
          <ChevronRight
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function DefaultTagPill({
  tag,
  className,
  href,
}: {
  tag: Pick<TransactionTag, "name" | "color" | "styleImageUrl">;
  className?: string;
  href?: string;
}) {
  const backgroundColor = tag.color ?? "#0A3D62";

  return (
    <div
      className={cn(
        "relative flex w-full overflow-hidden rounded-full",
        "border border-border/60 bg-card shadow-sm",
        className,
      )}
      style={{ height: PILL_HEIGHT }}
      aria-label={`Default tag: ${tag.name}`}
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

      <div className="flex w-1/2 min-w-0 items-center gap-1.5 px-3">
        <p
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold leading-none"
          style={{ color: backgroundColor }}
        >
          {tag.name}
        </p>
        {href ? (
          <ChevronRight
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
