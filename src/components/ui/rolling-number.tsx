"use client";

import React from "react";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function RollingDigit({
  digit,
  className,
  style,
}: {
  digit: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("inline-block tabular-nums", className)}
      style={{
        height: "1em",
        width: "0.65em",
        overflow: "hidden",
        lineHeight: 1,
        ...style,
      }}
    >
      <span
        className="block transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `translateY(-${digit}em)`,
          lineHeight: 1,
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="block text-center"
            style={{ height: "1em", lineHeight: 1, minHeight: "1em" }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface RollingNumberProps {
  /** Formatted number string (e.g. "315,335.000"). Only digits 0–9 roll; other chars render static. */
  value: string;
  className?: string;
  /** Width per digit column (default 0.6em) so digits aren’t clipped. */
  digitWidth?: string;
}

export function RollingNumber({
  value,
  className,
  digitWidth = "0.65em",
}: RollingNumberProps) {
  return (
    <span className={cn("inline-flex tabular-nums items-baseline", className)}>
      {value.split("").map((char, i) => {
        const d = parseInt(char, 10);
        if (!Number.isNaN(d) && d >= 0 && d <= 9) {
          return (
            <RollingDigit
              key={`d-${i}`}
              digit={d}
              style={{ width: digitWidth, minWidth: digitWidth }}
            />
          );
        }
        return (
          <span key={`s-${i}`} className="inline-block align-baseline">
            {char}
          </span>
        );
      })}
    </span>
  );
}
