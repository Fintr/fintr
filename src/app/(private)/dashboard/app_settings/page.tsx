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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { SpaceSwitcher } from "@/components/space/space-switcher";
import { useAtomValue } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";

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

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("spaceCode");
    }
    logout();
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Category Management",
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
      ],
    },
    {
      title: "Subscriptions",
      cards: [
        {
          title: "Manage Subscription",
          icon: CreditCard,
          href: "/dashboard/space_settings/subscriptions",
          color: "text-primary",
          bgColor: "bg-primary/10",
        },
      ],
    },
    {
      title: "Settings",
      cards: [
        {
          title: "Dashboard Settings",
          icon: Settings,
          href: "/dashboard/settings",
          color: "text-orange-600",
          bgColor: "bg-orange-50",
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
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        ...(isAdmin ? [{
          title: "Admin",
          icon: Users,
          href: "/admin",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        } as SettingsCard] : []),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 pb-24 md:pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            Hi {user?.name || "User"}
          </h1>
          <p className="text-primary/70 text-sm md:text-base">
            Manage your settings and preferences
          </p>
        </div>

        {/* Space Management Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-primary mb-4">Space Management</h2>
          <SpaceSwitcher showSpaceSwitcher={true} isMobile={false} />
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-primary mb-4">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {section.cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.title}
                      href={card.href}
                      className="block"
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
