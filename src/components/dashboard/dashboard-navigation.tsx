"use client";
import React, { useState } from "react";
import { ArrowRight, Bell, User, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AddTransactionDialog from "@/components/dashboard/add-transaction-dialog";
import NotificationsPopup from "@/components/dashboard/notifications-popup";
import { NotificationProps } from "@/components/dashboard/notification-item";

const DashboardNavigation = () => {
  const [showNotifications, setShowNotifications] = useState(false);

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

  return (
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
            <div>
              <AddTransactionDialog />
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center text-primary hover:text-primary/80">
                  <div className="bg-primary text-white rounded-full p-1 mr-2">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="font-medium">John Doe</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-red-600"
                  onClick={() => (window.location.href = "/")}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardNavigation;
