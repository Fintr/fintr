"use client";

export default function ProblemSection() {
  return (
    <section id="problem" className="py-[clamp(64px,8vw,120px)]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          The Problem
        </span>
        <h2 className="font-[family-name:var(--font-serif)] text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Managing personal finances is harder than it should be
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] max-w-[800px] mb-12">
          Globally, hundreds of millions of people manage money without structured tools or professional guidance. This leads to poor visibility on spending, missed savings, and costly financial decisions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0A2540] rounded-[16px] p-8 transition-all hover:border-[rgba(255,255,255,0.1)]">
            <div className="font-[family-name:var(--font-serif)] text-[48px] font-bold text-[#14B8A6] leading-none mb-4">
              01
            </div>
            <h3 className="text-[18px] font-semibold text-white mb-2">
              Low financial awareness
            </h3>
            <p className="text-[15px] text-white/70 leading-[1.7]">
              Most people don&apos;t have a clear picture of where their money goes. Without structured tracking, they overspend in low-priority areas and under-save for important goals.
            </p>
          </div>
          <div className="bg-[#0A2540] rounded-[16px] p-8 transition-all hover:border-[rgba(255,255,255,0.1)]">
            <div className="font-[family-name:var(--font-serif)] text-[48px] font-bold text-[#14B8A6] leading-none mb-4">
              02
            </div>
            <h3 className="text-[18px] font-semibold text-white mb-2">
              No easy way to track
            </h3>
            <p className="text-[15px] text-white/70 leading-[1.7]">
              Existing tools require manual entry or bank linking. In many markets, banks restrict third-party integrations, and users are hesitant to share credentials. This creates a gap no app has fully solved.
            </p>
          </div>
          <div className="bg-[#0A2540] rounded-[16px] p-8 transition-all hover:border-[rgba(255,255,255,0.1)]">
            <div className="font-[family-name:var(--font-serif)] text-[48px] font-bold text-[#14B8A6] leading-none mb-4">
              03
            </div>
            <h3 className="text-[18px] font-semibold text-white mb-2">
              Poor financial decisions
            </h3>
            <p className="text-[15px] text-white/70 leading-[1.7]">
              When considering major purchases or financial commitments, people lack the tools to assess affordability or compare options. They decide based on instinct or incomplete information.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
