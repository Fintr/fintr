"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  return (
    <nav className="fixed top-0 w-full bg-white/[0.92] backdrop-blur-[12px] z-[100] border-b border-black/[0.06]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12 py-3.5 flex justify-between items-center">
        <Link href="/" className="text-[22px] font-bold text-[#0A2540] tracking-[-0.5px] no-underline">
          Fintr
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="#about"
            className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F7F7F5] no-underline"
          >
            About
          </Link>
          <Link
            href="#features"
            className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F7F7F5] no-underline"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F7F7F5] no-underline"
          >
            Pricing
          </Link>
          <Link
            href="#team"
            className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F7F7F5] no-underline"
          >
            Team
          </Link>
          {isAuthenticated ? (
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-[#0A2540] text-white px-5 py-2 rounded-lg font-semibold text-[14px] transition-opacity hover:opacity-90"
            >
              Dashboard
            </button>
          ) : (
            <Link
              href="https://apps.apple.com/ph/app/fintr-finance-tracking/id6757146677"
              target="_blank"
              className="bg-[#0A2540] text-white px-5 py-2 rounded-lg font-semibold text-[14px] transition-opacity hover:opacity-90 no-underline"
            >
              Get the App
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
