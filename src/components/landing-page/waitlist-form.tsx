"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"
import { Loader2 } from "lucide-react";

interface WaitlistFormProps {
  onSubmit?: (email: string) => Promise<boolean>;
  buttonText?: string;
  placeholderText?: string;
  className?: string;
  redirectTo?: string;
}

const WaitlistForm = ({
  onSubmit = async (email) => {
    // Mock successful submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true;
  },
  buttonText = "Join Waitlist",
  placeholderText = "Enter your email",
  className = "",
  redirectTo = "/auth",
}: WaitlistFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Redirect to specified page
      window.location.href = redirectTo;
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full max-w-md ${className}`}>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 text-white rounded-md px-6 py-2"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>{buttonText}</>
        )}
      </Button>
    </div>
  );
};

export default WaitlistForm;
