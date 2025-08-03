"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("whitelists"); // Default active tab
  const [isSheetOpen, setIsSheetOpen] = useState(false); // State for mobile sheet
  const isAdmin = useAtomValue(isAdminAtom);
  const router = useRouter();

  const sidebarNavItems = [
    {
      title: "Whitelists",
      href: "/admin/whitelists",
    },
    // Add more admin tabs here if needed in the future
  ];

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard");
      toast.error("You are not authorized to access this page");
    }
  }, [pathname, isAdmin]);
  

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="flex items-center justify-between p-4 border-b md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open Admin menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <h2 className="text-xl font-semibold mb-4">Admin Dashboard</h2>
            <Separator className="my-4" />
            <nav className="flex flex-col space-y-1">
              {sidebarNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    pathname === item.href
                      ? "bg-muted hover:bg-muted"
                      : "hover:bg-transparent hover:underline",
                    "justify-start"
                  )}
                  onClick={() => {
                    setActiveTab(item.title.toLowerCase());
                    setIsSheetOpen(false); // Close sheet on navigation
                  }}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <h2 className="text-xl font-semibold">Admin Dashboard</h2>
      </header>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-gray-50 p-4 sticky top-0 hidden md:block">
        <h2 className="text-xl font-semibold mb-6">Admin Dashboard</h2>
        <nav className="flex flex-col space-y-1">
          {sidebarNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                pathname === item.href
                  ? "bg-muted hover:bg-muted"
                  : "hover:bg-transparent hover:underline",
                "justify-start"
              )}
              onClick={() => setActiveTab(item.title.toLowerCase())}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
} 
