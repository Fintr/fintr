"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Wallet, Plus, BarChart3, Menu, MessageSquare, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import EnhancedAiChatModal from "@/components/ai-chat/enhanced-ai-chat-modal";
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
  const [isAndroidNative, setIsAndroidNative] = useState(false);
  const [isIOSNative, setIsIOSNative] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    // Detect Android native (including WebView)
    const isAndroid = /Android/i.test(ua);
    const isFintrNative = uaLower.includes("fintrnativeapp");
    const isWebView = /; wv\)/.test(ua);
    const hasAndroidClass = document.documentElement.classList.contains("fintr-native-android");

    // Detect iOS native (including WebView)
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const hasIOSClass = document.documentElement.classList.contains("fintr-native-ios");

    setIsAndroidNative(isAndroid && (isFintrNative || isWebView || hasAndroidClass));
    setIsIOSNative(isIOS && (isFintrNative || isWebView || hasIOSClass));
  }, []);

  // Determine active tab based on pathname
  const getActiveValue = () => {
    if (pathname === "/dashboard/" || pathname === "/dashboard") {
      return "transactions";
    }
    if (pathname.startsWith("/dashboard/budgets")) {
      return "budgets";
    }
    if (pathname.startsWith("/dashboard/insights")) {
      return "insights";
    }
    if (
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

  const handleReceiptSuccess = (suggestedTransactionPayload: any, receiptImage: File, draftId?: string) => {
    const prefilledData = {
      type: 'expense' as const,
      amount: suggestedTransactionPayload?.amount,
      description: suggestedTransactionPayload?.description,
      categoryName: suggestedTransactionPayload?.categoryName,
      accountName: suggestedTransactionPayload?.accountName,
      date: suggestedTransactionPayload?.date,
      scheduleType: suggestedTransactionPayload?.scheduleType,
      receiptImage: receiptImage,
      draftId: draftId,
    };
    
    setPrefilledTransactionData(prefilledData);
    setIsAddTransactionOpen(true);
  };

  return (
    <>
      {/* Android 3-button nav safe-area spacer (keeps OS buttons visible). */}
      {isAndroidNative && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[55] md:hidden pointer-events-none"
          style={{
            height: "max(var(--safe-area-inset-bottom, 0px), 48px)",
            backgroundColor: "#FAFAF9",
          }}
        />
      )}

      <nav
        className={cn(
          "fixed left-0 right-0 z-50 bg-primary shadow-xs border-t border-primary/20 md:hidden",
          // Only add bottom padding for iOS and mobile browsers
          // Android has the white spacer below the nav for safe area
          isAndroidNative ? "" : "pb-4"
        )}
        style={{
          // Android shifts up for 3-button nav (white spacer handles the gap)
          // iOS sits at bottom with padding inside the nav
          bottom: isAndroidNative
            ? "max(var(--safe-area-inset-bottom, 0px), 48px)"
            : 0,
        }}
      >
        <div className="flex items-center justify-around h-16 px-2 max-w-full">
          {/* Transactions */}
          <Link
            href="/dashboard/"
            prefetch
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-2 min-w-0 ${
              activeValue === "transactions"
                ? "text-white"
                : "text-white/70"
            }`}
          >
            <FileText
              className={`h-5 w-5 ${
                activeValue === "transactions" ? "text-white" : "text-white/70"
              }`}
            />
            <span
              className={`text-xs font-medium truncate w-full text-center ${
                activeValue === "transactions" ? "text-white" : "text-white/70"
              }`}
            >
              Transactions
            </span>
          </Link>

          {/* Budget */}
          <Link
            href="/dashboard/budgets"
            prefetch
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-2 min-w-0 ${
              activeValue === "budgets" ? "text-white" : "text-white/70"
            }`}
          >
            <Wallet
              className={`h-5 w-5 ${
                activeValue === "budgets" ? "text-white" : "text-white/70"
              }`}
            />
            <span
              className={`text-xs font-medium truncate w-full text-center ${
                activeValue === "budgets" ? "text-white" : "text-white/70"
              }`}
            >
              Budget
            </span>
          </Link>

          {/* Add Button (Center) with Menu */}
          <div className="flex flex-col items-center justify-center -mt-4">
            <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 p-0 shadow-lg border-2 border-white/30 transition-all"
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
                className="w-56 p-2 mb-2 z-[10010]"
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
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Chat with AI</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => {
                      setIsAddTransactionOpen(true);
                      setIsMenuOpen(false);
                    }}
                    data-tutorial-target="mobile-add-transaction"
                  >
                    <Plus className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Add Transaction</span>
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
                    <Camera className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Add Receipt</span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Dashboard */}
          <Link
            href="/dashboard/insights"
            prefetch
            data-tutorial-target="mobile-dashboard-button"
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-2 min-w-0 ${
              activeValue === "insights" ? "text-white" : "text-white/70"
            }`}
          >
            <BarChart3
              className={`h-5 w-5 ${
                activeValue === "insights" ? "text-white" : "text-white/70"
              }`}
            />
            <span
              className={`text-xs font-medium truncate w-full text-center ${
                activeValue === "insights" ? "text-white" : "text-white/70"
              }`}
            >
              Dashboard
            </span>
          </Link>

          {/* Settings */}
          <Link
            href="/dashboard/app_settings"
            prefetch
            data-tutorial-target="mobile-menu-button"
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 py-2 min-w-0 ${
              activeValue === "space_settings" ? "text-white" : "text-white/70"
            }`}
          >
            <Menu
              className={`h-5 w-5 ${
                activeValue === "space_settings" ? "text-white" : "text-white/70"
              }`}
            />
            <span
              className={`text-xs font-medium truncate w-full text-center ${
                activeValue === "space_settings" ? "text-white" : "text-white/70"
              }`}
            >
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

