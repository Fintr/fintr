"use client";
import React, { useState, useEffect } from "react";
import { Bell, Settings, Camera, Plus, Menu, User as UserIcon, Target, Headphones, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import EnhancedAiChatModal from "@/components/ai-chat/enhanced-ai-chat-modal";
import NotificationsPopup from "@/components/dashboard/notifications-popup";
import { NotificationProps } from "@/components/dashboard/notification-item";
import NavDrawer from "@/components/dashboard/nav-drawer";
import Link from "next/link";
import { FintrLogo } from "@/components/brand/fintr-logo";
import { shouldShowV2Features } from "@/lib/utils";
import { resetGlobalAuthLock } from "@/components/deep-link-handler";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";

const headerSecondaryButtonClassName =
  "bg-card text-primary shadow-none hover:bg-primary hover:text-white";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardNavigationProps {
  hideActionButtons?: boolean;
  isAdmin?: boolean | null;
}

const DashboardNavigation = ({ hideActionButtons = false, isAdmin }: DashboardNavigationProps) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [prefilledTransactionData, setPrefilledTransactionData] = useState<any>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopNavOpen, setIsDesktopNavOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const pathname = usePathname();
  const showV2Features = shouldShowV2Features();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Show add buttons only on dashboard pages
  const isOnDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const showAddButtons = !hideActionButtons && isOnDashboard;

  const { logout, user } = useAuth();
  const { api } = useAuthApi();
  const { spaces } = useSpaceContext(api);

  // Check if any space has a new invitation
  const hasNewSpaceInvitations = spaces?.some(space => space.hasNewInvitation) || false;

  const [notifications, setNotifications] = useState<NotificationProps[]>(
    [
      {
        id: "1",
        type: "info",
        message: "Your monthly budget report is ready",
        time: "Just now",
        isRead: false,
      },
      {
        id: "2",
        type: "warning",
        message: "You're close to your spending limit for dining",
        time: "2 hours ago",
        isRead: false,
      },
      {
        id: "3",
        type: "success",
        message: "Successfully saved $200 this month",
        time: "Yesterday",
        isRead: true,
      },
    ]
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const handleReceiptSuccess = (suggestedTransactionPayload: any, receiptImage: File, draftId?: string) => {
    const prefilledData = {
      amount: suggestedTransactionPayload?.amount,
      description: suggestedTransactionPayload?.description,
      categoryName: suggestedTransactionPayload?.categoryName || suggestedTransactionPayload?.category_name,
      accountName: suggestedTransactionPayload?.accountName || suggestedTransactionPayload?.account_name,
      date: suggestedTransactionPayload?.date,
      scheduleType: suggestedTransactionPayload?.scheduleType || suggestedTransactionPayload?.schedule_type,
      receiptImage: receiptImage,
      draftId: draftId,
    };
    
    setPrefilledTransactionData(prefilledData);
    setIsAddTransactionOpen(true);
  };

  const handleLogout = () => {
    // Clear React Query cache for fresh data on next login
    console.log('🧹 Clearing React Query cache before logout...');
    queryClient.clear();
    
    // Reset global auth lock for next login
    console.log('🔓 Resetting global auth lock for next login...');
    resetGlobalAuthLock();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spaceCode');
    }
    
    logout();
  };

  const navItems: NavItem[] = [
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
    { title: "Support", href: "/crm/requests", icon: Headphones },
  ];

  if (showV2Features) {
    navItems.push({ title: "Goals", href: "/dashboard/goals", icon: Target });
  }

  if (isAdmin) {
    navItems.push({ title: "Admin", href: "/admin", icon: UserIcon });
  }

  return (
    <>
      <header className={`fixed w-full bg-background z-20 transition-all duration-300 ease-in-out ${
        isScrolled
          ? "border-b border-gray-200 shadow-sm dark:border-border"
          : "border-b border-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          {/* Desktop: Logo left, Add Receipt, Add Transaction, Notifications, Avatar right */}
          <div className="hidden md:flex flex-row items-center justify-between h-16 w-full gap-2">
            <div className="flex items-center md:mr-4">
              <Link href="/dashboard" aria-label="Go to Dashboard">
                <FintrLogo className="h-8 dark:h-12 w-auto" />
              </Link>
            </div>
            <div className="flex flex-1" />
            <div className="flex flex-row items-center gap-2 md:gap-4">
              <Button
                onClick={() => setIsAiChatOpen(true)}
                variant="ghost"
                className={headerSecondaryButtonClassName}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                AI Chat
              </Button>
              {showAddButtons && (
                <>
                  <Button
                    onClick={() => setIsAddReceiptOpen(true)}
                    variant="ghost"
                    className={headerSecondaryButtonClassName}
                    data-tutorial-target="add-receipt-button"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Add Receipt
                  </Button>
                  <Button
                    onClick={() => setIsAddTransactionOpen(true)}
                    className="bg-primary hover:bg-primary/80"
                    data-tutorial-target="add-transaction-button"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </>
              )}
              {
                showV2Features && (
                  <div className="relative flex items-center">
                    <button
                      className="text-primary hover:text-primary/80 relative"
                      onClick={toggleNotifications}
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-900/80 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    {showNotifications && (
                      <NotificationsPopup
                        notifications={notifications}
                        onClose={() => setShowNotifications(false)}
                        onMarkAllAsRead={handleMarkAllAsRead}
                      />
                    )}
                  </div>
                )
              }
              <div className="relative">
                <button
                  className="text-primary hover:text-primary/80 flex items-center gap-2"
                  onClick={() => setIsDesktopNavOpen(true)}
                >
                  <UserIcon className="h-5 w-5" />
                  <span>{user?.name || "User"}</span>
                </button>
                {hasNewSpaceInvitations && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <NavDrawer
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        onLogout={handleLogout}
        navItems={navItems}
        isMobile={true}
      />
      
      <NavDrawer
        open={isDesktopNavOpen}
        onClose={() => setIsDesktopNavOpen(false)}
        onLogout={handleLogout}
        navItems={navItems}
        isMobile={false}
      />
      
      <AddReceiptDialog
        isOpen={isAddReceiptOpen}
        onClose={() => setIsAddReceiptOpen(false)}
        onReceiptSuccess={handleReceiptSuccess}
      />
      
      <AddTransactionDialog 
        isOpen={isAddTransactionOpen}
        onClose={() => {
          setIsAddTransactionOpen(false);
          setPrefilledTransactionData(null);
        }}
        prefilledData={prefilledTransactionData}
      />
      
      <EnhancedAiChatModal
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
      />
    </>
  );
};

export default DashboardNavigation;
