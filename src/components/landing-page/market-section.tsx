"use client";

export default function MarketSection() {
  return (
    <section id="market" className="landing-section-y">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          Market Opportunity
        </span>
        <h2 className="font-landing-title text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Large, underserved market
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] max-w-[800px] mb-12">
          Personal finance management is underserved globally. Initial research is based on the Philippine market, where fintech is dominated by payments (40% to 50%) and lending (20% to 30%), leaving personal finance tools wide open.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center py-10 px-5 bg-white rounded-[16px] border border-black/[0.06]">
            <div className="font-landing-title text-[clamp(36px,4vw,48px)] font-bold text-[#0A2540] leading-none tracking-[-1px]">
              91.3%
            </div>
            <div className="text-[14px] text-[#78716C] mt-3 leading-[1.5]">
              of Filipino internet users use online financial services monthly
            </div>
          </div>
          <div className="text-center py-10 px-5 bg-white rounded-[16px] border border-black/[0.06]">
            <div className="font-landing-title text-[clamp(36px,4vw,48px)] font-bold text-[#0A2540] leading-none tracking-[-1px]">
              57.4%
            </div>
            <div className="text-[14px] text-[#78716C] mt-3 leading-[1.5]">
              of Philippine transactions by volume are now digital (2024), up from just 10% in 2018
            </div>
          </div>
          <div className="text-center py-10 px-5 bg-white rounded-[16px] border border-black/[0.06]">
            <div className="font-landing-title text-[clamp(36px,4vw,48px)] font-bold text-[#0A2540] leading-none tracking-[-1px]">
              16%
            </div>
            <div className="text-[14px] text-[#78716C] mt-3 leading-[1.5]">
              YoY growth in Philippine digital economy GMV (2024 vs 2025), 3rd highest in SEA
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[#A8A29E] mt-5 text-center">
          Source: Data Reportal, e-Conomy SEA Report via Foxmont 2026
        </p>

        {/* Why Now */}
        <div className="mt-16">
          <h3 className="font-landing-title text-[28px] tracking-[-0.5px] mb-2">
            Why now
          </h3>
          <p className="text-[#78716C] mb-8">Three trends converging at the right time.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[16px] p-8 border border-black/[0.06] transition-all hover:border-black/10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <h3 className="text-[18px] font-semibold text-[#0A2540] mb-2">
                AI cost deflation
              </h3>
              <p className="text-[15px] text-[#57534E] leading-[1.7]">
                Large language models and OCR APIs are now affordable enough to build consumer-grade AI products at low marginal cost. This was not viable even two years ago.
              </p>
            </div>
            <div className="bg-white rounded-[16px] p-8 border border-black/[0.06] transition-all hover:border-black/10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <h3 className="text-[18px] font-semibold text-[#0A2540] mb-2">
                Mobile-first adoption
              </h3>
              <p className="text-[15px] text-[#57534E] leading-[1.7]">
                Smartphone and internet access continues to grow significantly across emerging markets, creating a large addressable base for mobile-first financial tools.
              </p>
            </div>
            <div className="bg-white rounded-[16px] p-8 border border-black/[0.06] transition-all hover:border-black/10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <h3 className="text-[18px] font-semibold text-[#0A2540] mb-2">
                Growing financial awareness
              </h3>
              <p className="text-[15px] text-[#57534E] leading-[1.7]">
                Post-pandemic, more people are actively looking for tools to manage money better. Existing apps are often too complex, too foreign in design, or require bank linking that users don&apos;t trust.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
