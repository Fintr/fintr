"use client";
import React, { useState } from "react";
import { ArrowRight, Bell, User, LogOut, Settings, Camera, Plus } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import AddReceiptDialog from "@/components/dashboard/add-receipt-dialog";
import NotificationsPopup from "@/components/dashboard/notifications-popup";
import { NotificationProps } from "@/components/dashboard/notification-item";

const DashboardNavigation = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [prefilledTransactionData, setPrefilledTransactionData] = useState<any>(null);

  // Auth0 hook for logout functionality
  const { logout } = useAuth0();

  // Mock notification data
  const [notifications, setNotifications] = useState<NotificationProps[]>([
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
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const handleReceiptSuccess = (suggestedTransactionPayload: any, receiptImage: File) => {
    console.log('DashboardNavigation - handleReceiptSuccess called');
    console.log('DashboardNavigation - receiptImage:', receiptImage);
    console.log('DashboardNavigation - receiptImage type:', receiptImage?.type);
    console.log('DashboardNavigation - receiptImage size:', receiptImage?.size);
    
    // Transform the suggested payload to match our expected format
    const prefilledData = {
      type: 'expense' as const,
      amount: suggestedTransactionPayload.amount,
      description: suggestedTransactionPayload.description,
      categoryName: suggestedTransactionPayload.categoryName,
      accountName: suggestedTransactionPayload.accountName,
      date: suggestedTransactionPayload.date,
      scheduleType: suggestedTransactionPayload.scheduleType,
      receiptImage: receiptImage,
    };
    
    console.log('DashboardNavigation - prefilledData created:', prefilledData);
    console.log('DashboardNavigation - prefilledData.receiptImage:', prefilledData.receiptImage);
    
    // Set the prefilled data and open the transaction dialog
    setPrefilledTransactionData(prefilledData);
    setIsAddTransactionOpen(true);
  };

  const handleLogout = () => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spaceCode');
    }
    
    // Auth0 logout with redirect to home page
    logout({
      logoutParams: {
        returnTo: process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin
      }
    });
  };

  return (
    <>
      <header className="bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <img
                src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
                alt="Fintr Logo"
                className="h-8 w-auto"
              />
            </div>

            {/* Chatbot in the center */}
            <div className="flex-1 flex justify-center">
              <div className="relative w-full max-w-md">
                <div
                  className="bg-white border border-gray-200 hover:border-primary rounded-full py-2 px-4 shadow-sm transition-all flex items-center w-full cursor-pointer"
                  onClick={() => {
                    // Trigger the floating chatbot widget
                    const chatbotWidget = document.getElementById(
                      "dashboard-chatbot-widget-button",
                    );
                    if (chatbotWidget) {
                      chatbotWidget.click();
                    }
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask Fintr anything..."
                    className="bg-transparent border-none outline-none flex-grow text-sm text-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="text-primary hover:text-primary/80 bg-gray-100 rounded-full p-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* User profile and notifications */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setIsAddReceiptOpen(true)}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Add Receipt
                </Button>
                
                <Button
                  onClick={() => setIsAddTransactionOpen(true)}
                  className="bg-primary hover:bg-primary/80"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </div>
              {/* Notifications */}
              <div className="relative">
                <button
                  className="text-primary hover:text-primary/80 relative"
                  onClick={toggleNotifications}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
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

              {/* User profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="text-primary hover:text-primary/80">
                  <User className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      
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
    </>
  );
};

export default DashboardNavigation;
