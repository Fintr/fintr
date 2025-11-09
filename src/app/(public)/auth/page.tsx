"use client";
import React, { useState } from "react";
import UnifiedAuthPage from "@/components/auth/unified-auth-page";
import AuthToggle from "@/components/auth/auth-toggle";

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  const handleBack = () => {
    window.location.href = "/";
  };

  const handleToggle = (tab: "login" | "signup") => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <UnifiedAuthPage
          onBack={handleBack}
          isLogin={activeTab === "login"}
          authToggle={
            <AuthToggle activeTab={activeTab} onToggle={handleToggle} />
          }
        />
      </div>
    </div>
  );
};

export default Auth;
