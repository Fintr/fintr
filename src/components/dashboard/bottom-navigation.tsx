"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Wallet, Plus, BarChart3, Menu, MessageSquare, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-primary border-t border-primary/20 md:hidden safe-area-bottom">
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
                >
                  <Plus className="h-7 w-7 text-white stroke-[2.5]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                className="w-56 p-2 mb-2 z-[60]"
                sideOffset={12}
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
              Settings
            </span>
          </Link>
        </div>
      </nav>

      <AddTransactionDialog
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
      />
      <AddReceiptDialog
        isOpen={isAddReceiptOpen}
        onClose={() => setIsAddReceiptOpen(false)}
      />
      <EnhancedAiChatModal
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
      />
    </>
  );
}

