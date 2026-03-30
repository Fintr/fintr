"use client";

import Link from "next/link";

const teamMembers = [
  {
    name: "Paolo Paraiso",
    role: "Co-Founder & CEO",
    imageSrc: "/images/founders/paolo-paraiso.png",
    bio: "10+ years in B2B enterprise sales, strategic partnerships, and digital transformation across AI, data platforms, cloud, cybersecurity, and SaaS. Helps organizations turn data into measurable business outcomes through actionable insights and secure, governed AI. Leads product vision, go-to-market, and business development for Fintr.",
    companies: ["AI Rudder", "Globe Telecom", "IBM", "Petron"],
    linkedin: "https://linkedin.com/in/joelpaoloparaiso",
  },
  {
    name: "Miko Dagatan",
    role: "Co-Founder & CTO",
    imageSrc: "/images/founders/miko-dagatan.png",
    bio: "Senior full-stack software engineer with 8+ years of experience building scalable web applications. Expertise in Ruby on Rails, React, Next.js, and AWS. Has shipped products across companies in Australia, Thailand, Malaysia, and the Philippines. Leads Fintr's architecture, AI integration, infrastructure, and the entire technical stack.",
    companies: ["Reinteractive", "CodeCare", "Sourcepad", "Ateneo de Manila"],
    linkedin: "https://www.linkedin.com/in/miguel-alberto-dagatan-05401094/",
  },
];

export default function TeamSection() {
  return (
    <section id="team" className="landing-section-y">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="w-[40px] h-[3px] bg-[#0D9488] rounded-[2px] mb-5"></div>
        <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
          Founding Team
        </span>
        <h2 className="font-landing-title text-[clamp(32px,4vw,44px)] font-bold text-[#0A2540] leading-[1.12] tracking-[-1px] mb-4">
          Who&apos;s building Fintr
        </h2>
        <p className="text-[18px] leading-[1.75] text-[#57534E] mb-12">
          Enterprise technology experience meets deep technical capability.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="bg-[#FAF9F7] rounded-[16px] p-10 border border-black/[0.04]"
            >
              <div className="flex items-center gap-4 mb-5">
                <Link
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 rounded-full overflow-hidden ring-2 ring-black/[0.06] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
                  aria-label={`${member.name} on LinkedIn`}
                >
                  <img
                    src={member.imageSrc}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 object-cover"
                    decoding="async"
                  />
                </Link>
                <div>
                  <div className="font-landing-title text-[22px] font-bold text-[#0A2540] tracking-[-0.3px]">
                    {member.name}
                  </div>
                  <div className="text-[13px] font-semibold text-[#0D9488] mt-0.5">
                    {member.role}
                  </div>
                </div>
              </div>
              <p className="text-[15px] text-[#57534E] leading-[1.75] mb-5">
                {member.bio}
              </p>
              <div className="flex gap-2 flex-wrap mb-4">
                {member.companies.map((company) => (
                  <span
                    key={company}
                    className="bg-white px-3 py-1.5 rounded-[6px] text-[12px] font-semibold text-[#57534E] border border-black/[0.06]"
                  >
                    {company}
                  </span>
                ))}
              </div>
              <Link
                  href={member.linkedin}
                  target="_blank"
                  className="inline-flex items-center gap-2 text-[#0D9488] text-[14px] font-medium transition-opacity hover:opacity-70"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </Link>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="flex gap-4 mt-10 flex-wrap">
          <div className="flex items-center gap-2 bg-[#FAF9F7] px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-[#44403C] border border-black/[0.04]">
            🏆 NVIDIA Inception Member (Jan 2026)
          </div>
          <div className="flex items-center gap-2 bg-[#FAF9F7] px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-[#44403C] border border-black/[0.04]">
            📱 Live on Apple App Store
          </div>
          <div className="flex items-center gap-2 bg-[#FAF9F7] px-5 py-2.5 rounded-[10px] text-[14px] font-medium text-[#44403C] border border-black/[0.04]">
            🇵🇭 DTI-Registered Business
          </div>
        </div>

        {/* Vision Banner */}
        <div className="bg-[#0A2540] rounded-[20px] p-[clamp(40px,5vw,64px)] mt-14">
          <h3 className="font-landing-title text-[clamp(24px,3vw,32px)] font-bold text-white mb-4 leading-[1.2] tracking-[-0.5px]">
            More than a Finance Tracker
          </h3>
          <p className="text-white/70 text-[16px] max-w-[640px] leading-[1.75]">
            We&apos;re building a personal financial assistant that everyone deserves. Fintr&apos;s vision is to be the platform that guides you on your personal finance journey, from tracking your first peso to reaching your own version of financial freedom.
          </p>
        </div>
      </div>
    </section>
  );
}
