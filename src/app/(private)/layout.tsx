"use client";

import React, { useEffect } from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import { useAtomValue } from 'jotai';
import { isAdminAtom, isWhitelistedAtom } from '@/atoms/dashboardAtoms';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { usePathname } from 'next/navigation';
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const PrivateLayout = ({ children }: { children: React.ReactNode }) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const isAdmin = useAtomValue(isAdminAtom);
  const isWhitelisted = useAtomValue(isWhitelistedAtom);
  const pathname = usePathname();
  const router = useRouter();

  // Determine if action buttons should be hidden (e.g., on admin page)
  const hideActionButtons = pathname.startsWith("/admin");

  useGetSpaceCode(api);

  useEffect(() => {
    if (isWhitelisted != null && !isWhitelisted) {
      router.push("/");
      toast.error("Sorry. We're keeping this app invite only for now.");
    }
  }, [isWhitelisted]);
  return (
    <div className="min-h-screen bg-background text-primary">
      <DashboardNavigation hideActionButtons={hideActionButtons} isAdmin={isAdmin} />
      <div className="p-0 md:p-8 max-w-7xl mx-auto">{children}</div>
    </div>
  );
};

export default PrivateLayout;
