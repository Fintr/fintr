"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import {
  CategoryKind,
  findRootCategory,
} from "@/utils/categoryManagement";

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
  if (pathname.includes("/space_settings/categories/detail")) {
    return "Category";
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

/** Nested settings routes show back immediately (no scroll required). */
export const shouldShowImmediateBackButton = (pathname: string): boolean => {
  const immediateBackPrefixes = [
    "/dashboard/space_settings/accounts/detail",
    "/dashboard/space_settings/categories",
    "/dashboard/space_settings/accounts",
    "/dashboard/space_settings/import",
    "/dashboard/space_settings/subscriptions",
  ];

  return immediateBackPrefixes.some((prefix) => pathname.startsWith(prefix));
};

function MobileStickyHeaderContent({ title }: MobileStickyHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  const { expenseCategories, incomeCategories } = useTransactionCategories();

  const categoryDetailTitle = useMemo(() => {
    if (!pathname.includes("/space_settings/categories/detail")) {
      return null;
    }

    const categoryId = searchParams.get("categoryId");
    const kindParam = searchParams.get("kind");
    const kind: CategoryKind | null =
      kindParam === "income" || kindParam === "expense" ? kindParam : null;

    if (!categoryId || !kind) {
      return null;
    }

    const tree = kind === "income" ? incomeCategories : expenseCategories;
    const category = findRootCategory(tree, categoryId);

    if (!category?.name) {
      return null;
    }

    return `Category: ${category.name}`;
  }, [
    pathname,
    searchParams,
    expenseCategories,
    incomeCategories,
  ]);

  const pageTitle = title || categoryDetailTitle || getPageTitle(pathname);

  const showBackButton =
    isScrolled || shouldShowImmediateBackButton(pathname);

  const { isAndroidNative } = usePlatformDetection();

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

  // Android native: padding-top comes from globals.css (android-sticky-header-inset-top) so it
  // tracks live --safe-area-inset-top after rotation without waiting on React state.
  // iOS + mobile browsers: pt-safe-top supplies env(safe-area-inset-top).

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
        ${isAndroidNative ? "" : "pt-safe-top"}
        ${isScrolled ? "shadow-sm" : ""}
      `}
      style={isAndroidNative ? { paddingTop: "24px" } : undefined}
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
              ${showBackButton ? "opacity-100" : "opacity-0 pointer-events-none"}
              ${showBackButton ? "mr-2" : "mr-0 w-0"}
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

export default function MobileStickyHeader(props: MobileStickyHeaderProps) {
  return (
    <Suspense fallback={null}>
      <MobileStickyHeaderContent {...props} />
    </Suspense>
  );
}

