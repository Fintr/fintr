"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Settings,
  Users,
  Download,
  Folder,
  MessageSquare,
  ArrowLeft,
  LogOut,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { SpaceSwitcher } from "@/components/space/space-switcher";
import { useAtomValue } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import { useQueryClient } from "@tanstack/react-query";
import { resetGlobalAuthLock } from "@/components/deep-link-handler";

interface SettingsCard {
  title: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgColor: string;
}

interface SettingsSection {
  title: string;
  cards: SettingsCard[];
}

export default function AppSettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = useAtomValue(isAdminAtom);
  const queryClient = useQueryClient();

  // Extract login provider from user.sub (e.g., "google-oauth2|123" or "apple|456")
  const getLoginProvider = (): string => {
    if (!user?.sub) return "Email";
    if (user.sub.startsWith("google-oauth2")) return "Google";
    if (user.sub.startsWith("apple")) return "Apple";
    if (user.sub.startsWith("auth0")) return "Email";
    return "Email";
  };

  const loginProvider = getLoginProvider();

  const handleLogout = () => {
    try {
      // CRITICAL: Clear ALL React Query caches to ensure fresh data on next login
      // This fixes the infinite loading issue when logging in again
      console.log('🧹 Clearing React Query cache before logout...');
      queryClient.clear();
      
      // Reset the global auth lock to allow future logins
      console.log('🔓 Resetting global auth lock for next login...');
      resetGlobalAuthLock();
      
      // Clear all local storage items related to auth and space
      if (typeof window !== "undefined") {
        localStorage.removeItem("spaceCode");
        // Clear any other auth-related items
        localStorage.removeItem("authData");
        localStorage.removeItem("tokens");
        localStorage.removeItem("user");
      }
      // Call logout which clears auth storage and redirects
      // This is client-side only and doesn't require backend
      logout();
    } catch (error) {
      // Even if something fails, try to clear and redirect
      console.error("Error during logout:", error);
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Menu",
      cards: [
        {
          title: "Loans",
          icon: FileText,
          href: "/dashboard/loans",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
      ],
    },
    {
      title: "Settings",
      cards: [
        {
          title: "Categories",
          icon: Folder,
          href: "/dashboard/space_settings/categories",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
        {
          title: "Accounts",
          icon: Users,
          href: "/dashboard/space_settings/accounts",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
        {
          title: "Import",
          icon: Download,
          href: "/dashboard/space_settings/import",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
        {
          title: "Manage Subscription",
          icon: CreditCard,
          href: "/dashboard/space_settings/subscriptions",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
        {
          title: "Dashboard Settings",
          icon: Settings,
          href: "/dashboard/settings",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
      ],
    },
    {
      title: "Contact & Support",
      cards: [
        {
          title: "Support",
          icon: MessageSquare,
          href: "/crm/requests",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
        ...(isAdmin ? [{
          title: "Admin",
          icon: Users,
          href: "/admin",
          color: "text-primary",
          bgColor: "bg-primary/10",
        } as SettingsCard] : []),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background p-2 pb-24 md:pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            Hi {user?.name || "User"}
          </h1>
          
          {/* Login Method and Email */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {loginProvider}
            </span>
            <span className="text-primary/70 text-sm break-all">
              {user?.email}
            </span>
          </div>
          
          <p className="text-primary/70 text-sm md:text-base">
            Manage your settings and preferences
          </p>
        </div>

        {/* Space Management Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-primary mb-4">Space Management</h2>
          <SpaceSwitcher 
            showSpaceSwitcher={true} 
            isMobile={false}
            defaultExpanded={true}
          />
        </div>

        {/* Menu Sections */}
        <div className="space-y-8">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-primary mb-4">
                {section.title}
              </h2>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {section.cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.title}
                      href={card.href}
                      className="block"
                      {...(card.title === "Loans" ? { "data-tutorial-target": "loan-menu-item" } : {})}
                    >
                      <div
                        className={`
                          ${card.bgColor}
                          ${card.color}
                          rounded-lg p-4 md:p-6
                          h-full
                          flex flex-col items-center justify-center
                          gap-3
                          transition-all
                          hover:shadow-md
                          hover:scale-[1.02]
                          cursor-pointer
                          border border-transparent
                          hover:border-primary/20
                        `}
                      >
                        <Icon className="h-8 w-8 md:h-10 md:w-10" />
                        <span className="text-xs md:text-sm font-medium text-center">
                          {card.title}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Log Out Section */}
        <div className="mt-8">
          <Button
            onClick={handleLogout}
            className="w-full bg-red-900 hover:bg-red-800 text-white"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
