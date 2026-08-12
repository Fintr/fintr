"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Plus, BarChart3, Menu, MessageSquare, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import EnhancedAiChatModal from "@/components/ai-chat/enhanced-ai-chat-modal";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { usePrefetchDashboardNavRoutes } from "@/hooks/usePrefetchDashboardNavRoutes";
import { calculateNavBottomOffset } from "@/lib/platform-detection";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function BottomNavigation() {
  const pathname = usePathname();
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [prefilledTransactionData, setPrefilledTransactionData] = useState<any>(null);

  const { isAndroidNative, isIOSNative, safeAreaInsetBottom, hasAndroid3ButtonNav } = usePlatformDetection();

  usePrefetchDashboardNavRoutes();

  const navBottomOffset = calculateNavBottomOffset(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav
  );

  // Determine active tab based on pathname
  const getActiveValue = () => {
    if (pathname.startsWith("/dashboard/home")) {
      return "home";
    }
    if (pathname === "/dashboard/" || pathname === "/dashboard") {
      return "transactions";
    }
    if (pathname.startsWith("/dashboard/insights")) {
      return "insights";
    }
    if (
      pathname.startsWith("/dashboard/budgets") ||
      pathname.startsWith("/dashboard/loans") ||
      pathname.startsWith("/dashboard/app_settings") ||
      pathname.startsWith("/dashboard/space_settings") ||
      pathname.startsWith("/dashboard/settings") ||
      pathname.startsWith("/crm/requests") ||
      pathname.startsWith("/admin")
    ) {
      return "space_settings";
    }
    return "transactions";
  };

  const activeValue = getActiveValue();

  const navItemClassName = (isActive: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
      isActive
        ? "text-primary dark:text-primary-dark-mode"
        : "text-foreground/60 dark:text-muted-foreground",
    );

  const navIconClassName = (isActive: boolean) =>
    cn(
      "h-5 w-5",
      isActive
        ? "text-primary dark:text-primary-dark-mode"
        : "text-foreground/60 dark:text-muted-foreground",
    );

  const navLabelClassName = (isActive: boolean) =>
    cn(
      "w-full truncate text-center text-xs font-medium",
      isActive
        ? "text-primary dark:text-primary-dark-mode"
        : "text-foreground/60 dark:text-muted-foreground",
    );

  const handleReceiptSuccess = (suggestedTransactionPayload: any, receiptImage: File, draftId?: string) => {
    const prefilledData = {
      amount: suggestedTransactionPayload?.amount,
      description: suggestedTransactionPayload?.description,
      categoryName: suggestedTransactionPayload?.categoryName || suggestedTransactionPayload?.category_name,
      accountName: suggestedTransactionPayload?.accountName || suggestedTransactionPayload?.account_name,
      date: suggestedTransactionPayload?.date,
      scheduleType: suggestedTransactionPayload?.scheduleType || suggestedTransactionPayload?.schedule_type,
      entityName:
        suggestedTransactionPayload?.entityName ||
        suggestedTransactionPayload?.entity_name,
      receiptMerchantDetected:
        suggestedTransactionPayload?.receiptMerchantDetected ||
        suggestedTransactionPayload?.receipt_merchant_detected,
      receiptImage: receiptImage,
      draftId: draftId,
    };
    
    setPrefilledTransactionData(prefilledData);
    setIsAddTransactionOpen(true);
  };

  return (
    <>
      {isAndroidNative && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 h-12 md:hidden pointer-events-none bg-[#FAFAF9] dark:bg-background"
        />
      )}

      <nav
        className={cn(
          "fixed left-0 right-0 z-50 md:hidden",
          "border-t border-border/60 bg-card/95 backdrop-blur-md",
          "shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)]",
          isAndroidNative
            ? ""
            : isIOSNative
              ? "pb-2"
              : ""
        )}
        style={{
          bottom: navBottomOffset,
        }}
      >
        <div className="flex items-center justify-around h-16 px-2 max-w-full">
          {/* Home */}
          <Link
            href="/dashboard/home"
            onPointerEnter={() => {
              if (navigator.onLine) {
                void import("@/components/dashboard/tabs/home");
              }
            }}
            className={navItemClassName(activeValue === "home")}
          >
            <Home className={navIconClassName(activeValue === "home")} />
            <span className={navLabelClassName(activeValue === "home")}>
              Home
            </span>
          </Link>

          {/* Transactions */}
          <Link
            href="/dashboard/"
            data-testid="mobile-nav-transactions"
            className={navItemClassName(activeValue === "transactions")}
          >
            <FileText className={navIconClassName(activeValue === "transactions")} />
            <span className={navLabelClassName(activeValue === "transactions")}>
              Transactions
            </span>
          </Link>

          {/* Add Button (Center) with Menu */}
          <div className="flex flex-col items-center justify-center -mt-4">
            <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="h-14 w-14 rounded-full border border-border bg-primary p-0 shadow-lg transition-all hover:bg-primary/90 dark:border-border/60"
                  size="icon"
                  aria-label="Add Options"
                  data-tutorial-target="mobile-add-button"
                >
                  <Plus className="h-7 w-7 text-white stroke-[2.5]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                className="w-72 p-2 mb-2 z-[10010]"
                sideOffset={12}
                style={{ zIndex: 10010 }}
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => {
                      setIsAiChatOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
                    <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-medium">Chat with AI</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        Ask about your spending, budgets, and finances
                      </span>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onPointerDown={(e) => {
                      // Prevent default to stop immediate click handling
                      e.preventDefault();
                      // Close popover first
                      setIsMenuOpen(false);
                      // Use longer delay to ensure popover focus restoration completes
                      setTimeout(() => {
                        setIsAddTransactionOpen(true);
                      }, 150);
                    }}
                    onClick={(e) => {
                      // Prevent the click from re-triggering
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    data-tutorial-target="mobile-add-transaction"
                    data-testid="mobile-add-transaction"
                  >
                    <Plus className="h-5 w-5 shrink-0 text-primary" />
                    <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-medium">Add Transaction</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        Record expenses, income, transfers, or loans
                      </span>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => {
                      setIsAddReceiptOpen(true);
                      setIsMenuOpen(false);
                    }}
                    data-tutorial-target="mobile-add-receipt"
                  >
                    <Camera className="h-5 w-5 shrink-0 text-primary" />
                    <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-medium">Add Receipt</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        Snap or upload a receipt to auto-fill details
                      </span>
                    </div>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Dashboard */}
          <Link
            href="/dashboard/insights"
            data-tutorial-target="mobile-dashboard-button"
            data-testid="mobile-nav-dashboard"
            className={navItemClassName(activeValue === "insights")}
          >
            <BarChart3 className={navIconClassName(activeValue === "insights")} />
            <span className={navLabelClassName(activeValue === "insights")}>
              Dashboard
            </span>
          </Link>

          {/* Settings */}
          <Link
            href="/dashboard/app_settings"
            data-tutorial-target="mobile-menu-button"
            data-testid="mobile-nav-menu"
            className={navItemClassName(activeValue === "space_settings")}
          >
            <Menu className={navIconClassName(activeValue === "space_settings")} />
            <span className={navLabelClassName(activeValue === "space_settings")}>
              Menu
            </span>
          </Link>
        </div>
      </nav>

      <AddTransactionDialog
        isOpen={isAddTransactionOpen}
        onClose={() => {
          setIsAddTransactionOpen(false);
          setPrefilledTransactionData(null);
        }}
        prefilledData={prefilledTransactionData}
      />
      <AddReceiptDialog
        isOpen={isAddReceiptOpen}
        onClose={() => setIsAddReceiptOpen(false)}
        onReceiptSuccess={handleReceiptSuccess}
      />
      <EnhancedAiChatModal
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
      />
    </>
  );
}
