"use client";

import {
  useRef,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/utils";

const TOUCH_TAP_MOVE_THRESHOLD_PX = 10;

type TouchPoint = {
  value: string;
  x: number;
  y: number;
};

export type FilterOptionPill = {
  value: string;
  label: string;
};

export interface FilterOptionPillsProps {
  options: FilterOptionPill[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  id?: string;
  scrollable?: boolean;
}

export const FilterOptionPills = ({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  id,
  scrollable = false,
}: FilterOptionPillsProps) => {
  const touchPointRef = useRef<TouchPoint | null>(null);
  const ignoreClickRef = useRef(false);

  const handlePointerDown = (
    optionValue: string,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    ignoreClickRef.current = false;

    if (event.pointerType === "mouse") {
      if (scrollable) {
        event.preventDefault();
      }
      return;
    }

    touchPointRef.current = {
      value: optionValue,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (
    optionValue: string,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === "mouse") {
      return;
    }

    const start = touchPointRef.current;
    touchPointRef.current = null;
    if (!start || start.value !== optionValue) {
      return;
    }

    const movedX = Math.abs(event.clientX - start.x);
    const movedY = Math.abs(event.clientY - start.y);
    if (
      movedX > TOUCH_TAP_MOVE_THRESHOLD_PX
      || movedY > TOUCH_TAP_MOVE_THRESHOLD_PX
    ) {
      return;
    }

    ignoreClickRef.current = true;
    onChange(optionValue);
  };

  const handleClick = (
    optionValue: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.detail === 0) {
      ignoreClickRef.current = false;
      onChange(optionValue);
      return;
    }

    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    onChange(optionValue);
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-2",
        scrollable
          ? "flex-nowrap overflow-x-auto pb-1 touch-manipulation"
          : "flex-wrap",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onPointerDown={(event) => handlePointerDown(option.value, event)}
            onPointerUp={(event) => handlePointerUp(option.value, event)}
            onPointerCancel={() => {
              touchPointRef.current = null;
            }}
            onClick={(event) => handleClick(option.value, event)}
            className={cn(
              "cursor-pointer touch-manipulation rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              scrollable && "shrink-0 whitespace-nowrap",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10 dark:border-0 dark:bg-input/30 dark:text-muted-foreground dark:hover:bg-input/50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default FilterOptionPills;
