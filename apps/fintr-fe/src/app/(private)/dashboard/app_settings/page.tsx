"use client";
import Link from "next/link";
import React from "react";
import {
  CreditCard,
  Settings,
  Users,
  Download,
  Folder,
  MessageSquare,
  LogOut,
  FileText,
  Wallet,
  Contact,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SpaceSwitcher } from "@/components/space/space-switcher";
import { useAtomValue } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import { useQueryClient } from "@tanstack/react-query";
import { resetGlobalAuthLock } from "@/components/deep-link-handler";
import { ThemeToggleCard } from "@/components/settings/theme-toggle-card";
import { ProfileSunAvatar } from "@/components/settings/profile-sun-avatar";
import { TitleBadge } from "@/components/badges/title-badge";
import { TitleLadder } from "@/components/badges/title-ladder";
import { BadgeShelf } from "@/components/badges/badge-shelf";
import { ProfileLevelBar } from "@/components/badges/profile-level-bar";
import { AchievementDetailSheet } from "@/components/badges/achievement-detail-sheet";
import { useGamificationProfile } from "@/hooks/async/useGamificationProfile";
import type { GamificationAchievement } from "@/types/badgeTypes";
import type { LevelTitle } from "@/types/badgeTypes";
import { cn } from "@/lib/utils";

const settingsMenuCardClassName = cn(
  "bg-primary/10 dark:bg-card",
  "text-primary",
  "rounded-lg p-4 md:p-6",
  "h-full",
  "flex flex-col items-center justify-center",
  "gap-3",
  "shadow-sm",
  "transition-all",
  "hover:shadow-md hover:scale-[1.02]",
  "cursor-pointer",
  "border border-transparent",
  "hover:border-primary/20",
);

interface SettingsCard {
  title: string;
  icon: React.ElementType;
  href: string;
}

interface SettingsSection {
  title: string;
  cards: SettingsCard[];
}

export default function AppSettingsPage() {
  const { user, logout } = useAuth();
  const isAdmin = useAtomValue(isAdminAtom);
  const queryClient = useQueryClient();
  const { data: profile } = useGamificationProfile();
  const [selectedAchievement, setSelectedAchievement] =
    React.useState<GamificationAchievement | null>(null);
  const [selectedTitle, setSelectedTitle] = React.useState<LevelTitle | null>(null);
  const [showBadges, setShowBadges] = React.useState(false);

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
          title: "Budget",
          icon: Wallet,
          href: "/dashboard/budgets",
        },
        {
          title: "Loans",
          icon: FileText,
          href: "/dashboard/loans",
        },
        {
          title: "Entities",
          icon: Contact,
          href: "/dashboard/space_settings/entities",
        },
        {
          title: "Tags",
          icon: Tags,
          href: "/dashboard/space_settings/tags",
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
        },
        {
          title: "Accounts",
          icon: Users,
          href: "/dashboard/space_settings/accounts",
        },
        {
          title: "Import",
          icon: Download,
          href: "/dashboard/space_settings/import",
        },
        {
          title: "Manage Subscription",
          icon: CreditCard,
          href: "/dashboard/space_settings/subscriptions",
        },
        {
          title: "Dashboard Settings",
          icon: Settings,
          href: "/dashboard/settings",
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
        },
        ...(isAdmin ? [{
          title: "Admin",
          icon: Users,
          href: "/admin",
        } as SettingsCard] : []),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-2 pb-24 md:pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center px-4 py-8 text-center">
          <div className="relative mb-3">
            <ProfileSunAvatar
              src={user?.picture}
              name={user?.name}
              alt={user?.name ? `${user.name}'s profile photo` : "Profile photo"}
            />
            <div className="absolute -bottom-1 -right-1">
              <TitleBadge title={profile?.title} size="sm" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-primary md:text-3xl">
            {user?.name || "User"}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {loginProvider}
            </span>
            {profile?.title ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {profile.title.title}
              </span>
            ) : null}
            <span className="break-all text-sm text-primary/70">
              {user?.email}
            </span>
          </div>

          {profile ? (
            <ProfileLevelBar
              className="mt-4"
              level={profile.level}
              xpIntoLevel={profile.xpIntoLevel}
              xpPerLevel={profile.xpPerLevel}
            />
          ) : null}

          {profile?.titles?.length || profile?.achievements?.length ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-primary/20 bg-primary/5 px-4 text-primary hover:bg-primary/10"
                onClick={() => setShowBadges((open) => !open)}
                aria-expanded={showBadges}
              >
                {showBadges ? "hide badges" : "show badges"}
              </Button>
            </div>
          ) : null}
        </div>

        {showBadges && profile?.titles?.length ? (
          <div className="mb-6 rounded-lg border border-primary/10 bg-primary/5 p-4">
            <TitleLadder
              titles={profile.titles}
              currentLevel={profile.level}
              onSelect={setSelectedTitle}
            />
          </div>
        ) : null}

        {showBadges && profile?.achievements?.length ? (
          <div className="mb-8 rounded-lg border border-primary/10 bg-primary/5 p-4">
            <BadgeShelf
              achievements={profile.achievements}
              title="Badges"
              onSelect={setSelectedAchievement}
            />
          </div>
        ) : null}

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
                        className={settingsMenuCardClassName}
                      >
                        <Icon className="h-8 w-8 md:h-10 md:w-10" />
                        <span className="text-xs md:text-sm font-medium text-center">
                          {card.title}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {section.title === "Settings" ? <ThemeToggleCard /> : null}
              </div>
            </div>
          ))}
        </div>

        {/* Space Management Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-primary mb-4">Space Management</h2>
          <SpaceSwitcher 
            showSpaceSwitcher={true} 
            isMobile={false}
            defaultExpanded={true}
          />
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

      <AchievementDetailSheet
        achievement={selectedAchievement}
        open={Boolean(selectedAchievement)}
        onOpenChange={(open) => {
          if (!open) setSelectedAchievement(null);
        }}
      />
      <AchievementDetailSheet
        title={selectedTitle}
        open={Boolean(selectedTitle)}
        onOpenChange={(open) => {
          if (!open) setSelectedTitle(null);
        }}
      />
    </div>
  );
}
