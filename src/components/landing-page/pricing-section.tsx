"use client";

const pricingPlans = [
  {
    name: "Free",
    price: "₱0",
    period: "Free forever",
    featured: false,
    features: [
      "Track expenses, budgets, loans & goals",
      "Financial health & analytics",
      "30 tokens for OCR & AI Chat",
    ],
  },
  {
    name: "Essential",
    price: "₱199",
    period: "per month",
    featured: false,
    features: [
      "Everything in Free",
      "+50 tokens for OCR & AI Chat",
      "Data & AI new features on release",
    ],
    roadmapTag: "Soon",
  },
  {
    name: "Growth",
    price: "₱299",
    period: "per month",
    featured: true,
    popular: true,
    features: [
      "Everything in Essential",
      "+100 tokens for OCR & AI Chat",
      "Assessment & Eligibility",
      "Compare & Decide",
    ],
    roadmapTags: ["Soon", "Soon"],
  },
  {
    name: "Wealth",
    price: "₱549",
    period: "per month",
    featured: false,
    features: [
      "Everything in Growth",
      "+250 tokens for OCR & AI Chat",
      "Assessment & Eligibility",
      "Compare & Decide",
    ],
    roadmapTags: ["Soon", "Soon"],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-[#FAF9F7] py-[clamp(64px,8vw,120px)]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          Pricing
        </span>
        <h2 className="font-[family-name:var(--font-serif)] text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Start free, upgrade when you&apos;re ready
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] mb-12">
          Every plan includes core finance tracking. Paid plans unlock more AI tokens and upcoming premium features.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[16px] p-8 border flex flex-col transition-all ${
                plan.featured
                  ? "border-[#0D9488] bg-gradient-to-b from-[#F0FDFA] to-white relative"
                  : "border-[#E8E6E3] bg-white hover:border-[#A8A29E] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0D9488] text-white text-[11px] font-bold uppercase tracking-[1px] px-3.5 py-1 rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="text-[14px] font-bold uppercase tracking-[1px] text-[#78716C] mb-2">
                {plan.name}
              </div>
              <div className="font-[family-name:var(--font-serif)] text-[32px] font-bold text-[#0A2540] mb-1">
                {plan.price}
              </div>
              <div className="text-[13px] text-[#A8A29E] mb-6">{plan.period}</div>
              <div className="h-[1px] bg-[#E8E6E3] mb-6"></div>
              <ul className="flex flex-col gap-3 flex-grow">
                {plan.features.map((feature, index) => (
                  <li
                    key={feature}
                    className="text-[14px] text-[#57534E] leading-[1.5] flex gap-2.5 items-start"
                  >
                    <span className="text-[#0D9488] font-bold mt-0.5">✓</span>
                    <span>
                      {feature}
                      {plan.roadmapTag && index === plan.features.length - 1 && (
                        <span className="inline-block bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded ml-1">
                          {plan.roadmapTag}
                        </span>
                      )}
                      {plan.roadmapTags &&
                        index >= plan.features.length - 2 &&
                        plan.roadmapTags[index - (plan.features.length - 2)] && (
                          <span className="inline-block bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded ml-1">
                            Soon
                          </span>
                        )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
