"use client";

import React from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

type AnimatedCurrencyProps = {
  amount: number;
  currency: string;
  className?: string;
  enabled?: boolean;
  duration?: number;
  restartOnTargetChange?: boolean;
  maximumFractionDigits?: number;
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(
  currency: string,
  maximumFractionDigits?: number,
): Intl.NumberFormat {
  const key = `${currency}:${maximumFractionDigits ?? "auto"}`;
  const cached = currencyFormatters.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    ...(maximumFractionDigits !== undefined
      ? {
          minimumFractionDigits: maximumFractionDigits,
          maximumFractionDigits,
        }
      : {}),
  });
  currencyFormatters.set(key, formatter);
  return formatter;
}

function formatAnimatedCurrency(
  amount: number,
  currency: string,
  maximumFractionDigits?: number,
): string {
  const roundedAmount =
    maximumFractionDigits === 0 ? Math.round(amount) : amount;

  return currencyFormatter(currency, maximumFractionDigits).format(
    roundedAmount,
  );
}

export function AnimatedCurrency({
  amount,
  currency,
  className,
  enabled = true,
  duration = 500,
  restartOnTargetChange = false,
  maximumFractionDigits,
}: AnimatedCurrencyProps) {
  const animatedAmount = useCountUp(amount, {
    enabled,
    duration,
    restartOnTargetChange,
  });

  return (
    <span className={cn("tabular-nums", className)}>
      {formatAnimatedCurrency(
        animatedAmount,
        currency,
        maximumFractionDigits,
      )}
    </span>
  );
}
