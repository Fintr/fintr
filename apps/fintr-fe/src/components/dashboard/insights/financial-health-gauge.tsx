"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { easeOutCubic } from "@/hooks/useRevealProgress";

const GAUGE_CIRCUMFERENCE = 282.7;
const ANIMATION_DURATION_MS = 1200;

const GAUGE_TRACK_STROKE_CLASS =
  "stroke-[#e2e8f0] dark:stroke-white/15";

const gaugeStrokeClass = (score: number): string => {
  if (score >= 80) {
    return "stroke-teal-600 dark:stroke-teal-400";
  }

  if (score >= 60) {
    return "stroke-[#0A3D62] dark:stroke-orange-400";
  }

  return "stroke-[#0A3D62] dark:stroke-red-400";
};

interface FinancialHealthGaugeProps {
  score: number;
}

export const FinancialHealthGauge = ({ score }: FinancialHealthGaugeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatedValueRef = useRef(0);
  const isInView = useInView(containerRef, {
    once: true,
    amount: 0.45,
  });
  const shouldReduceMotion = useReducedMotion();
  const [animatedScore, setAnimatedScore] = useState(
    shouldReduceMotion ? score : 0,
  );

  const clampedScore = Math.max(0, Math.min(score, 100));
  const displayScore = Math.round(animatedScore);
  const strokeDashoffset =
    GAUGE_CIRCUMFERENCE
    - (GAUGE_CIRCUMFERENCE * animatedScore / 100);

  useEffect(() => {
    if (shouldReduceMotion) {
      animatedValueRef.current = clampedScore;
      setAnimatedScore(clampedScore);
      return;
    }

    if (!isInView) {
      return;
    }

    let cancelled = false;
    const from = animatedValueRef.current;
    const to = clampedScore;
    const start = performance.now();

    const frame = (now: number) => {
      if (cancelled) {
        return;
      }

      const progress = Math.min((now - start) / ANIMATION_DURATION_MS, 1);
      const next = from + (to - from) * easeOutCubic(progress);

      animatedValueRef.current = next;
      setAnimatedScore(next);

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      animatedValueRef.current = to;
      setAnimatedScore(to);
    };

    requestAnimationFrame(frame);

    return () => {
      cancelled = true;
    };
  }, [clampedScore, isInView, shouldReduceMotion]);

  return (
    <div
      ref={containerRef}
      className="relative mb-4 h-40 w-40"
      aria-label={`Financial health score ${displayScore} out of 100`}
      role="img"
    >
      <div className="absolute inset-0 flex items-center justify-center border-0 ring-0 dark:border-0 dark:ring-0">
        <div
          className="text-4xl font-bold text-primary tabular-nums dark:text-foreground"
          aria-hidden
        >
          {displayScore}
        </div>
      </div>
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          className={GAUGE_TRACK_STROKE_CLASS}
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          className={gaugeStrokeClass(clampedScore)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
};
