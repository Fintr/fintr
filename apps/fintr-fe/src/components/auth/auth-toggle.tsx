"use client";

import React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AuthToggleProps {
  activeTab: "login" | "signup";
  onToggle: (tab: "login" | "signup") => void;
}

const AuthToggle = ({ activeTab, onToggle }: AuthToggleProps) => {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onToggle(value as "login" | "signup")}
      className="mx-auto mb-6 w-full max-w-md"
    >
      <TabsList className="grid h-full w-full grid-cols-2 rounded-lg bg-white dark:bg-card dark:shadow-sm">
        <TabsTrigger value="login">Log In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default AuthToggle;
