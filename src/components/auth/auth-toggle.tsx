import React from "react";
import { Button } from "../ui/button";

interface AuthToggleProps {
  activeTab: "login" | "signup";
  onToggle: (tab: "login" | "signup") => void;
}

const AuthToggle = ({ activeTab, onToggle }: AuthToggleProps) => {
  return (
    <div className="max-w-md mx-auto bg-gray-100 p-1 rounded-lg flex mb-6">
      <Button
        variant={activeTab === "login" ? "default" : "ghost"}
        className={`flex-1 ${activeTab === "login" ? "bg-[#0A3D62] text-white shadow-sm" : "bg-transparent hover:bg-gray-200"}`}
        onClick={() => onToggle("login")}
      >
        Log In
      </Button>
      <Button
        variant={activeTab === "signup" ? "default" : "ghost"}
        className={`flex-1 ${activeTab === "signup" ? "bg-[#0A3D62] text-white shadow-sm" : "bg-transparent hover:bg-gray-200"}`}
        onClick={() => onToggle("signup")}
      >
        Sign Up
      </Button>
    </div>
  );
};

export default AuthToggle;
