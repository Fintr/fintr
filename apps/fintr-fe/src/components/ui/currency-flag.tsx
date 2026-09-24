"use client";

import React, { useState } from "react";

import { cn } from "@/lib/utils";
import {
  getCountryCodeForCurrency,
  getFlagEmoji,
} from "@/data/currencies";

const CIRCLE_FLAG_BASE_PATH = "/circle-flags";

export interface CurrencyFlagProps {
  currencyCode: string;
  className?: string;
  /** Pixel size for the circular flag (default 40). */
  size?: number;
}

export function getCircleFlagSrc(countryCode: string): string {
  return `${CIRCLE_FLAG_BASE_PATH}/${countryCode.toLowerCase()}.svg`;
}

/**
 * Circular country flag for a currency code (ISO 4217), using bundled circle-flags SVGs.
 * Falls back to a regional-indicator emoji when the SVG is unavailable.
 */
export function CurrencyFlag({
  currencyCode,
  className,
  size = 40,
}: CurrencyFlagProps) {
  const countryCode = getCountryCodeForCurrency(currencyCode);
  const [imageFailed, setImageFailed] = useState(false);

  if (!countryCode || imageFailed) {
    const emoji = getFlagEmoji(countryCode);
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-muted/50 leading-none",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
        aria-hidden
      >
        {emoji || currencyCode.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={getCircleFlagSrc(countryCode)}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
      onError={() => setImageFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
