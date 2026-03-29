"use client";

const availableFeatures = [
  {
    icon: "📸",
    title: "OCR Receipt Scanning",
    description: "Snap a photo of any receipt or screenshot. Fintr extracts the data and logs it automatically. No manual entry needed.",
  },
  {
    icon: "💰",
    title: "Full Finance Tracking",
    description: "Track income, expenses, loans, goals, and investments in one place. Custom categories. Multiple account management. Fast, simple input designed to build consistent habits.",
  },
  {
    icon: "🤖",
    title: "AI Financial Assistant",
    description: "Ask questions about your money and get personalized answers grounded in your actual data. Monthly summaries, spending insights, and actionable recommendations.",
  },
  {
    icon: "📊",
    title: "AI-Powered Insights",
    description: "Financial health score. Category-level spend patterns. Habitual spending trends. Budget adherence tracking. All powered by RAG to personalize insights based on your data.",
  },
  {
    icon: "🎯",
    title: "Budgets & Financial Health",
    description: "Set monthly or custom budgets per category. Monitor your financial health with a clear dashboard showing income, expenses, and net savings over time.",
  },
  {
    icon: "🔒",
    title: "No Bank Integration Needed",
    description: "Privacy-first by design. Track your finances without connecting bank accounts — minimizing the risk of data leaks while keeping full control of your data.",
  },
];

const roadmapFeatures = [
  {
    icon: "🏠",
    title: "Affordability Assessment",
    description: "Planning a major purchase? Fintr will assess if you can afford it based on your actual financial data — with loan assessment, eligibility checks, and investment readiness scoring.",
  },
  {
    icon: "⚖️",
    title: "Compare & Decide",
    description: "Side-by-side comparisons for debt consolidation, loan options, insurance, and real estate investments — so you can make informed decisions before you commit.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-[#FAF9F7] py-[clamp(64px,8vw,120px)]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          Features
        </span>
        <h2 className="font-[family-name:var(--font-serif)] text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Everything you need to take control of your money
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] mb-14">
          Not just a finance tracker — a platform that guides you toward your own version of financial freedom.
        </p>

        {/* Available Now */}
        <div className="mb-16">
          <div className="text-[12px] font-bold uppercase tracking-[2px] text-[#A8A29E] mb-6 pb-4 border-b border-[#E8E6E3]">
            Available Now
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableFeatures.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-[16px] p-8 border border-black/[0.06] transition-all hover:border-black/10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
              >
                <div className="w-11 h-11 rounded-[12px] bg-[#FAF9F7] flex items-center justify-center text-[20px] mb-5">
                  {feature.icon}
                </div>
                <h3 className="text-[18px] font-semibold text-[#0A2540] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[15px] text-[#57534E] leading-[1.7]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap */}
        <div className="mb-12">
          <div className="text-[12px] font-bold uppercase tracking-[2px] text-[#A8A29E] mb-6 pb-4 border-b border-[#E8E6E3]">
            On Our Roadmap
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roadmapFeatures.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-[16px] p-8 border border-dashed border-[#E8E6E3]"
              >
                <div className="w-11 h-11 rounded-[12px] bg-[#FEF3C7] flex items-center justify-center text-[20px] mb-5">
                  {feature.icon}
                </div>
                <h3 className="text-[18px] font-semibold text-[#0A2540] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[15px] text-[#57534E] leading-[1.7]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-[12px] p-5 mt-8 flex gap-3 items-start">
            <span className="text-[18px] mt-0.5">💡</span>
            <p className="text-[14px] text-[#44403C] leading-[1.65]">
              These features represent our vision: Fintr is not just a finance tracker. It&apos;s a platform that guides you on your personal finance journey to reach your own version of financial freedom. Roadmap features may evolve based on user feedback.
            </p>
          </div>
        </div>

        {/* Stage Bar */}
        <div className="flex bg-[#FAF9F7] rounded-[12px] overflow-hidden border border-black/[0.06]">
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-medium text-[#0D9488]">
            ✓ Idea
          </div>
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-medium text-[#0D9488]">
            ✓ MVP
          </div>
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-medium text-[#0D9488]">
            ✓ Beta
          </div>
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-bold bg-[#0D9488] text-white">
            ● Launched
          </div>
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-medium text-[#A8A29E]">
            Growth
          </div>
          <div className="flex-1 text-center py-4 px-3 text-[13px] font-medium text-[#A8A29E]">
            Scale
          </div>
        </div>
      </div>
    </section>
  );
}
