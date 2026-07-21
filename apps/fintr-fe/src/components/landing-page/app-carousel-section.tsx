"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { AppStoreBadge } from "@/components/landing-page/app-store-badge";

const appScreenshots = [
  {
    src: "/images/app-screenshots/1.png",
    alt: "Track expenses easily with Fintr",
    title: "Easily Track Your Expenses",
    description: "Monitor your spending and avoid money stress",
  },
  {
    src: "/images/app-screenshots/2.png",
    alt: "Stay on budget with Fintr",
    title: "Stay on Budget",
    description: "Set budgets and save money effectively",
  },
  {
    src: "/images/app-screenshots/3.png",
    alt: "Track loans to be debt-free",
    title: "Track Your Loans",
    description: "Monitor your loans and work toward being debt-free",
  },
  {
    src: "/images/app-screenshots/4.png",
    alt: "Spot spending habits early",
    title: "Spending Insights",
    description: "Visualize your expense breakdown with charts",
  },
  {
    src: "/images/app-screenshots/5.png",
    alt: "Transfer transaction history",
    title: "Import & Export",
    description: "Easily transfer your transaction history",
  },
  {
    src: "/images/app-screenshots/6.png",
    alt: "Take a photo of receipts",
    title: "Receipt Scanning",
    description: "Just take a photo of your receipt to log expenses",
  },
  {
    src: "/images/app-screenshots/7.png",
    alt: "Get personalized AI answers",
    title: "AI Assistant",
    description: "Get personalized answers about your money",
  },
];

export default function AppCarouselSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { 
      loop: true,
      align: "center",
      skipSnaps: false,
    },
    [Autoplay({ delay: 4000, stopOnInteraction: false })]
  );
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  return (
    <section className="landing-section-y bg-[#0A2540] overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="text-center mb-12">
          <span className="inline-block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#14B8A6] mb-4">
            App Preview
          </span>
          <h2 className="font-landing-title text-[clamp(32px,4vw,44px)] font-bold text-white leading-[1.12] tracking-[-1px] mb-4">
            See Fintr in Action
          </h2>
          <p className="text-[18px] text-white/70 max-w-[600px] mx-auto">
            Explore the features that make managing your finances simple and intuitive
          </p>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {appScreenshots.map((screenshot, index) => (
              <div
                key={index}
                className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-4 first:pl-0"
              >
                <div className="bg-white/5 backdrop-blur-sm rounded-[24px] p-6 border border-white/10 h-[650px]">
                  <div className="relative w-full h-full rounded-[20px] overflow-hidden shadow-2xl">
                    <Image
                      src={screenshot.src}
                      alt={screenshot.alt}
                      fill
                      className="object-contain"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots Navigation */}
        <div className="flex justify-center gap-2 mt-8">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === selectedIndex
                  ? "bg-[#14B8A6] w-6"
                  : "bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <AppStoreBadge size="lg" />
        </div>
      </div>
    </section>
  );
}
