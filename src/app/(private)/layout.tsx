import React from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0A3D62]">
      <DashboardNavigation />
      <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
    </div>
  );
};

export default DashboardLayout;
