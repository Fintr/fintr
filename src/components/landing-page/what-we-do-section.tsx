"use client";

export default function WhatWeDoSection() {
  return (
    <section className="bg-[#FAF9F7] py-[clamp(64px,8vw,120px)]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          What We Do
        </span>
        <h2 className="font-[family-name:var(--font-serif)] text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Your personal finance assistant,<br />powered by AI
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] max-w-[800px] mb-5">
          Fintr is a mobile-first AI finance assistant that lets you log expenses by photographing receipts, receive personalized spending insights, set budgets, and work toward your financial goals — all in one app.
        </p>
        <p className="text-[15px] text-[#57534E] max-w-[800px] leading-[1.8]">
          In many markets, banks are restrictive about third-party app integrations, and users are cautious about sharing their account credentials. Fintr removes that friction entirely. Using OCR receipt scanning and AI-driven analysis, you can track every transaction without connecting your bank. The AI assistant answers your money questions, generates monthly financial summaries, and helps you understand where your money goes — so you can make informed decisions instead of relying on instinct.
        </p>
      </div>
    </section>
  );
}
