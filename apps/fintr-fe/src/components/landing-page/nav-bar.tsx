"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncSpacerHeight = () => {
      const navHeight = navRef.current?.offsetHeight ?? 0;

      if (spacerRef.current) {
        spacerRef.current.style.height = `${navHeight}px`;
      }
    };

    syncSpacerHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && navRef.current
        ? new ResizeObserver(syncSpacerHeight)
        : null;

    resizeObserver?.observe(navRef.current as Element);
    window.addEventListener("resize", syncSpacerHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncSpacerHeight);
    };
  }, [isAuthenticated]);

  return (
    <>
      <nav
        ref={navRef}
        data-testid="landing-navbar"
        className="fixed inset-x-0 top-0 z-[100] border-b border-[#E8E6E3]/80 bg-[#FAF9F7]"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="max-w-[1200px] mx-auto pl-6 sm:px-10 lg:px-12 py-3 flex justify-between items-center gap-4">
          <Link href="/" className="flex items-center shrink-0 no-underline">
            <img
              src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
              alt="Fintr"
              width={40}
              height={40}
              className="h-8 sm:h-9 w-auto block"
              decoding="async"
              fetchPriority="high"
            />
          </Link>
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
            <Link
              href="https://blog.fintr.ai"
              className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F0EFEC] no-underline"
            >
              Blog
            </Link>
            <Link
              href="#features"
              className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F0EFEC] no-underline"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F0EFEC] no-underline"
            >
              Pricing
            </Link>
            <Link
              href="#team"
              className="hidden sm:block text-[14px] font-medium text-[#57534E] px-4 py-2 rounded-lg transition-all hover:text-[#1C1917] hover:bg-[#F0EFEC] no-underline"
            >
              Team
            </Link>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="bg-[#0A2540] text-white px-4 sm:px-5 py-2 rounded-lg font-semibold text-[13px] sm:text-[14px] transition-opacity hover:opacity-90 inline-flex items-center justify-center no-underline"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-2 pr-6 md:pr-0">
                <Link
                  href="https://apps.apple.com/ph/app/fintr-finance-tracking/id6757146677"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block transition-opacity hover:opacity-80 hidden lg:block"
                >
                  <Image
                    src="/images/app-store-badge.png"
                    alt="Download on the App Store"
                    width={140}
                    height={47}
                    className="h-[46px] w-auto"
                  />
                </Link>
                <Link
                  href="/auth"
                  className="border border-[#D6D3D1] bg-white/80 text-[#0A2540] px-3.5 sm:px-5 py-2 rounded-lg font-semibold text-[13px] sm:text-[14px] transition-colors hover:bg-white hover:border-[#A8A29E] no-underline whitespace-nowrap"
                >
                  Log In / Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      <div
        ref={spacerRef}
        aria-hidden="true"
        className="min-h-[60px]"
        data-testid="landing-navbar-spacer"
      />
    </>
  );
}
