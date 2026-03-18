"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileStickyHeaderProps {
  title?: string;
}

const getPageTitle = (pathname: string): string => {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "Transactions";
  }
  if (pathname.startsWith("/dashboard/budgets")) {
    return "Budgets";
  }
  if (pathname.startsWith("/dashboard/loans")) {
    return "Loans";
  }
  if (pathname.startsWith("/dashboard/goals")) {
    return "Goals";
  }
  if (pathname.startsWith("/dashboard/investments")) {
    return "Investments";
  }
  if (pathname.startsWith("/dashboard/insights")) {
    return "Dashboard";
  }
  if (pathname.startsWith("/dashboard/space_settings/categories")) {
    return "Category Management";
  }
  if (pathname.startsWith("/dashboard/space_settings/accounts")) {
    return "Account Management";
  }
  if (pathname.startsWith("/dashboard/space_settings/import")) {
    return "Import & Export";
  }
  if (pathname.startsWith("/dashboard/space_settings/subscriptions")) {
    return "Subscription Management";
  }
  if (pathname.startsWith("/dashboard/space_settings")) {
    return "Space Settings";
  }
  if (pathname.startsWith("/dashboard/app_settings")) {
    return "Settings";
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return "Dashboard Settings";
  }
  if (pathname.startsWith("/crm/requests")) {
    return "Support";
  }
  if (pathname.startsWith("/admin")) {
    return "Admin";
  }
  return "Dashboard";
};

export default function MobileStickyHeader({ title }: MobileStickyHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const pageTitle = title || getPageTitle(pathname);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBack = () => {
    router.back();
  };

  return (
    <header
      className={`
        md:hidden
        w-full
        bg-background
        fixed
        top-0
        left-0
        right-0
        transition-all
        duration-300
        ease-in-out
        z-30
        pt-safe-top
        ${isScrolled ? "shadow-sm" : ""}
      `}
    >
      <div className="px-2 py-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className={`
              h-8 w-8 p-0
              transition-all
              duration-300
              ease-in-out
              ${isScrolled ? "opacity-100" : "opacity-0 pointer-events-none"}
              ${isScrolled ? "mr-2" : "mr-0 w-0"}
            `}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-primary" />
          </Button>
          <h1
            className={`
              text-lg font-bold text-primary
              transition-all
              duration-300
              ease-in-out
              pt-1
              leading-none
              ${isScrolled ? "pl-0" : "pl-0"}
            `}
          >
            {pageTitle}
          </h1>
        </div>
      </div>
      {/* Animated border that appears on scroll */}
      <div
        className={`
          h-px
          bg-gray-200
          transition-all
          duration-300
          ease-in-out
          ${isScrolled ? "opacity-100" : "opacity-0"}
        `}
      />
    </header>
  );
}


