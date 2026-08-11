"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

const EMBLA_OPTIONS = {
  align: "center" as const,
  containScroll: "trimSnaps" as const,
  dragFree: false,
  duration: 16,
  skipSnaps: false,
  slidesToScroll: 1,
};

interface InsightMetricCarouselProps {
  slideCount: number;
  children: ReactNode;
  className?: string;
}

export const insightMetricSlideClassName =
  "min-w-0 shrink-0 grow-0 basis-[72%] pl-3 first:pl-4 last:pr-4 sm:basis-[58%] sm:first:pl-5 sm:last:pr-5 md:basis-[48%]";

export const InsightMetricCarousel = ({
  slideCount,
  children,
  className,
}: InsightMetricCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(EMBLA_OPTIONS);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.reInit(EMBLA_OPTIONS);
  }, [emblaApi, slideCount]);

  return (
    <div
      className={cn("insight-metric-carousel overflow-hidden", className)}
      ref={emblaRef}
    >
      <div className="flex touch-pan-y gap-3">{children}</div>
    </div>
  );
};
