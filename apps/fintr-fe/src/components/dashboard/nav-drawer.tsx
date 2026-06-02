"use client";

import React, { useEffect, useState } from 'react';
import { X, User, LogOut, Moon, Sun } from 'lucide-react';
import Link from "next/link";
import { useTheme } from "next-themes";
import { applyThemeWithNativeSync } from "@/lib/sync-theme-to-native";
import { useAuth } from "@/contexts/AuthContext";
import { SpaceSwitcher } from "@/components/space/space-switcher";
import { Switch } from "@/components/ui/switch";

const navDrawerItemClassName =
  "flex w-full items-center gap-2 rounded px-2 py-2 text-primary hover:bg-gray-100 dark:text-primary-dark-mode dark:hover:bg-accent/50";

function NavDrawerThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted ? (isDark ? "Dark Mode" : "Light Mode") : "Appearance";

  return (
    <button
      type="button"
      className={navDrawerItemClassName}
      onClick={() => {
        if (!mounted) return;
        applyThemeWithNativeSync(setTheme, isDark ? "light" : "dark");
      }}
      disabled={!mounted}
      aria-label={
        mounted
          ? isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
          : "Appearance"
      }
    >
      {isDark ? (
        <Moon className="h-4 w-4 shrink-0 mr-2" aria-hidden />
      ) : (
        <Sun className="h-4 w-4 shrink-0 mr-2" aria-hidden />
      )}
      <span className="flex-1 text-left">{label}</span>
      {mounted ? (
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => {
            applyThemeWithNativeSync(setTheme, checked ? "dark" : "light");
          }}
          onClick={(event) => event.stopPropagation()}
          aria-hidden
          tabIndex={-1}
          className="shrink-0"
        />
      ) : (
        <span className="h-[1.15rem] w-8 shrink-0" aria-hidden />
      )}
    </button>
  );
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  navItems: NavItem[];
  isMobile?: boolean;
  showSpaceSwitcher?: boolean;
}

const NavDrawer: React.FC<NavDrawerProps> = ({ 
  open, 
  onClose, 
  onLogout, 
  navItems, 
  isMobile = true,
  showSpaceSwitcher = true 
}) => {
  const { user } = useAuth();

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-full bg-white text-card-foreground shadow-lg transform transition-transform duration-300 ease-in-out dark:bg-card
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ willChange: 'transform' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Single close button */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-primary focus:outline-none dark:text-muted-foreground dark:hover:text-primary-dark-mode"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="h-6 w-6" />
        </button>
        <div className={`${isMobile ? 'pt-12' : 'pt-4'} px-6 pb-6 flex flex-col gap-4 h-full overflow-y-auto`}>
          {/* Menu header */}
          <h3 className="mb-2 text-lg font-semibold">
            {isMobile ? "Menu" : "Account"}
          </h3>
          
          {/* Space Switcher Section */}
          <SpaceSwitcher 
            showSpaceSwitcher={showSpaceSwitcher} 
            isMobile={isMobile} 
          />
          
          {/* User Info */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left font-semibold text-primary hover:bg-gray-100 focus:outline-none dark:text-primary-dark-mode dark:hover:bg-accent/50"
              onClick={() => {}}
              aria-expanded={true}
              aria-controls="account-menu"
            >
              <User className="h-5 w-5 mr-2" />
              {user?.name || "User"}
            </button>
            
            {/* Navigation Items */}
            <div
              id="account-menu"
              className="overflow-visible transition-none max-h-full opacity-100"
              style={{ pointerEvents: 'auto' }}
            >
              {navItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={navDrawerItemClassName}
                  onClick={onClose}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.title}
                </Link>
              ))}

              <NavDrawerThemeToggle />
              
              {/* Logout */}
              <button 
                className={navDrawerItemClassName}
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </aside>

    </>
  );
};

export default NavDrawer; 
