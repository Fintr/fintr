"use client";

import Link from "next/link";
import { AppStoreBadge } from "@/components/landing-page/app-store-badge";

export default function HeroSection() {
  return (
    <section className="landing-section-y">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-[800px]">
            <span className="block text-[13px] font-semibold uppercase tracking-[1.5px] text-[#0D9488] mb-4">
              AI-POWERED PERSONAL FINANCE ASSISTANT
            </span>
            <h1 className="font-landing-title text-[clamp(40px,5.5vw,64px)] font-bold leading-[1.08] text-[#0A2540] tracking-[-1.5px] mb-6">
              Save more. Spend smarter. Afford the life you want.
            </h1>
            <p className="text-[18px] leading-[1.75] text-[#57534E] max-w-[600px] mb-10">
              Fintr is an AI-powered personal finance assistant that helps you track your money, understand your spending, and make smarter financial decisions. No bank account linking needed.
            </p>
            <div className="flex gap-3 items-center flex-wrap">
              <AppStoreBadge
                size="lg"
                className="mt-1"
              />
              <Link
                href="#features"
                className="inline-flex items-center gap-2 bg-transparent text-[#0A2540] px-7 py-3.5 rounded-[10px] font-semibold text-[15px] border border-[#E8E6E3] transition-all hover:border-[#A8A29E] hover:bg-[#F7F7F5]"
              >
                See how it works
              </Link>
            </div>
            <div className="flex gap-6 mt-12 flex-wrap">
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#78716C]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#0D9488]"></span>
                NVIDIA Inception Member
              </span>
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#78716C]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#0D9488]"></span>
                AWS Activate Founders Member
              </span>
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#78716C]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#0D9488]"></span>
                Google for Startups Member
              </span>
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#78716C]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#0D9488]"></span>
                Live on the App Store
              </span>
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#78716C]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#0D9488]"></span>
                DTI-Registered Business
              </span>
            </div>
          </div>
          
          <div className="relative w-full max-w-[400px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-br from-[#0D9488]/10 to-[#0A2540]/5">
            <video
              autoPlay
              muted
              loop
              playsInline
              controls
              controlsList="nodownload nofullscreen"
              disablePictureInPicture
              className="w-full h-full object-cover"
            >
              <source src="/videos/hero-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
