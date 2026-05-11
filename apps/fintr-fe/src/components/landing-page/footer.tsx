"use client";

import Link from "next/link";
import { FintrSocialIconLinks } from "@/components/social/fintr-social";

export default function Footer() {
  return (
    <footer className="landing-section-y border-t border-black/[0.06]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex items-center shrink-0 no-underline">
            <img
              src="/fintr-logo.png"
              alt="Fintr"
              width={50}
              height={50}
              className="h-16 w-auto block"
              decoding="async"
              fetchPriority="low"
            />
          </Link>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link
              href="https://apps.apple.com/ph/app/fintr-finance-tracking/id6757146677"
              target="_blank"
              className="text-[14px] text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              App Store
            </Link>
            <Link
              href="mailto:joelpaoloparaiso@gmail.com"
              className="text-[14px] text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              Contact
            </Link>
            <Link
              href="/terms-of-service"
              className="text-[14px] text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="text-[14px] text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              Privacy Policy
            </Link>
          </div>
          <FintrSocialIconLinks variant="landing" />
        </div>
        <div className="mt-6 text-center">
          <span className="text-[13px] text-[#A8A29E]">© 2026 Fintr. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
