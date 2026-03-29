"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 border-t border-black/[0.06]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[18px] font-bold text-[#0A2540]">Fintr</span>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link
              href="https://www.fintr.ai"
              target="_blank"
              className="text-[14px] text-[#78716C] transition-colors hover:text-[#1C1917]"
            >
              fintr.ai
            </Link>
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
          <span className="text-[13px] text-[#A8A29E]">© 2026 Fintr. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
