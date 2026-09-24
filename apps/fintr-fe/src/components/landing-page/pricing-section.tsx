"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { PRO_FEATURES } from "@/lib/pro-features";
import { cn } from "@/lib/utils";

const freeFeatures = [
  "Track expenses, budgets, loans, and goals",
  "7-day Fintr Pro trial",
];

export default function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="landing-section-y bg-[#FAF9F7]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          Pricing
        </span>
        <h2 className="font-landing-title text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Start free, upgrade when you&apos;re ready
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] mb-12">
          Every account includes core finance tracking and a 7-day Fintr Pro trial.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div
            className="rounded-[16px] p-8 border border-[#E8E6E3] bg-white flex flex-col order-1 md:order-none md:col-start-1 md:row-start-2"
          >
            <div className="text-[14px] font-bold uppercase tracking-[1px] text-[#78716C] mb-2">
              Free
            </div>
            <div className="font-landing-title text-[32px] font-bold text-[#0A2540] mb-1">
              ₱0
            </div>
            <div className="text-[13px] text-[#A8A29E] mb-6">Free forever</div>
            <div className="h-[1px] bg-[#E8E6E3] mb-6"></div>
            <ul className="flex flex-col gap-3">
              {freeFeatures.map((feature) => (
                <li
                  key={feature}
                  className="text-[14px] text-[#57534E] leading-[1.5] flex gap-2.5 items-start"
                >
                  <span className="text-[#0D9488] font-bold mt-0.5">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="flex items-center justify-center gap-3 order-2 md:order-none md:col-start-2 md:row-start-1"
          >
            <span
              className={cn(
                "text-[14px] font-semibold transition-colors",
                !isYearly ? "text-[#0A2540]" : "text-[#A8A29E]",
              )}
            >
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              aria-label="Toggle between monthly and yearly Fintr Pro pricing"
              className="data-[state=checked]:bg-[#0D9488] data-[state=unchecked]:bg-[#E8E6E3] h-7 w-12 [&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[calc(100%-4px)]"
            />
            <span
              className={cn(
                "text-[14px] font-semibold transition-colors",
                isYearly ? "text-[#0A2540]" : "text-[#A8A29E]",
              )}
            >
              Yearly
            </span>
          </div>

          <div
            className="rounded-[16px] p-8 border border-[#0D9488] bg-gradient-to-b from-[#F0FDFA] to-white relative flex flex-col order-3 md:order-none md:col-start-2 md:row-start-2"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0D9488] text-white text-[11px] font-bold uppercase tracking-[1px] px-3.5 py-1 rounded-full whitespace-nowrap">
              Fintr Pro
            </div>
            <div className="text-[14px] font-bold uppercase tracking-[1px] text-[#78716C] mb-2">
              Pro
            </div>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <div className="font-landing-title text-[32px] font-bold text-[#0A2540]">
                  {isYearly ? "₱1,000" : "₱100"}
                </div>
                {isYearly ? (
                  <span className="text-[12px] font-bold text-[#0D9488] bg-[#0D9488]/10 px-2 py-0.5 rounded-full">
                    Save 17%
                  </span>
                ) : null}
              </div>
              <div className="text-[13px] text-[#A8A29E]">
                {isYearly ? "per year" : "per month"}
              </div>
            </div>
            <div className="h-[1px] bg-[#E8E6E3] mb-6"></div>
            <ul className="flex flex-col gap-4">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature.key}
                  className="text-[14px] text-[#57534E] leading-[1.5] flex gap-2.5 items-start"
                >
                  <span className="text-[#0D9488] font-bold mt-0.5">✓</span>
                  <span>
                    <span className="font-medium text-[#0A2540]">
                      {feature.name}
                    </span>
                    {feature.available ? null : (
                      <span className="inline-block bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded ml-1">
                        Soon
                      </span>
                    )}
                    <span className="mt-0.5 block text-[13px] leading-[1.5] text-[#78716C]">
                      {feature.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
