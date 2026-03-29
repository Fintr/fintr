"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";

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
    <section className="bg-[#0A2540] py-[clamp(64px,8vw,120px)] overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="text-center mb-12">
          <span className="inline-block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#14B8A6] mb-4">
            App Preview
          </span>
          <h2 className="font-[family-name:var(--font-serif)] text-[clamp(32px,4vw,44px)] font-bold text-white leading-[1.12] tracking-[-1px] mb-4">
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
                <div className="bg-white/5 backdrop-blur-sm rounded-[24px] p-6 border border-white/10">
                  <div className="relative aspect-[9/19] rounded-[20px] overflow-hidden shadow-2xl">
                    <Image
                      src={screenshot.src}
                      alt={screenshot.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="text-[18px] font-semibold text-white mb-2">
                      {screenshot.title}
                    </h3>
                    <p className="text-[14px] text-white/60">
                      {screenshot.description}
                    </p>
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
          <a
            href="https://apps.apple.com/ph/app/fintr-finance-tracking/id6757146677"
            target="_blank"
            className="inline-flex items-center gap-2 bg-white text-[#0A2540] px-8 py-4 rounded-[12px] font-semibold text-[16px] transition-transform hover:scale-105"
          >
            Download on App Store
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/>
              <path d="M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z"/>
              <path d="M12 12v8"/>
              <path d="M8 16h8"/>
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
