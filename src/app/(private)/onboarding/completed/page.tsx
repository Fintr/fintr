"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

// Custom SVG component for the completion icon
const CompletionIcon = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto"
  >
    {/* Sonar-like circles */}
    <circle
      cx="60"
      cy="60"
      r="55"
      stroke="rgb(59 130 246)"
      strokeWidth="1"
      fill="none"
      opacity="0.2"
    />
    <circle
      cx="60"
      cy="60"
      r="45"
      stroke="rgb(59 130 246)"
      strokeWidth="1"
      fill="none"
      opacity="0.4"
    />
    <circle
      cx="60"
      cy="60"
      r="35"
      stroke="rgb(59 130 246)"
      strokeWidth="2"
      fill="none"
      opacity="0.6"
    />
    
    {/* Main background circle */}
    <circle
      cx="60"
      cy="60"
      r="30"
      fill="rgb(59 130 246)"
      opacity="0.1"
    />
    
    {/* Book icon */}
    <g transform="translate(35, 35)">
      {/* Book cover */}
      <rect
        x="10"
        y="8"
        width="30"
        height="36"
        rx="2"
        fill="rgb(59 130 246)"
        opacity="0.8"
      />
      {/* Book pages */}
      <rect
        x="12"
        y="6"
        width="26"
        height="36"
        rx="1"
        fill="white"
        stroke="rgb(59 130 246)"
        strokeWidth="1"
      />
      {/* Book spine */}
      <line
        x1="15"
        y1="8"
        x2="15"
        y2="40"
        stroke="rgb(59 130 246)"
        strokeWidth="1"
        opacity="0.6"
      />
      {/* Page lines */}
      <line
        x1="18"
        y1="14"
        x2="32"
        y2="14"
        stroke="rgb(107 114 128)"
        strokeWidth="0.5"
        opacity="0.4"
      />
      <line
        x1="18"
        y1="18"
        x2="30"
        y2="18"
        stroke="rgb(107 114 128)"
        strokeWidth="0.5"
        opacity="0.4"
      />
      <line
        x1="18"
        y1="22"
        x2="32"
        y2="22"
        stroke="rgb(107 114 128)"
        strokeWidth="0.5"
        opacity="0.4"
      />
    </g>
    
    {/* Check mark */}
    <g transform="translate(70, 70)">
      <circle
        cx="15"
        cy="15"
        r="15"
        fill="rgb(34 197 94)"
      />
      <path
        d="M8 15l4 4 8-8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  </svg>
);

export default function OnboardingCompleted() {
  const router = useRouter();

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator - Complete */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Completed</span>
            <span>Setup Complete</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-full"></div>
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center px-4">
            <div className="mb-6">
              <CompletionIcon />
            </div>
            <CardTitle className="text-2xl text-primary dark:text-green-400">
              Congratulations! 🎉
            </CardTitle>
            <CardDescription className="text-lg">
              You've successfully completed your financial setup
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 px-6">
            <div className="text-center space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  What's been set up:
                </h3>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>✅ Income information</li>
                  <li>✅ Budget categories</li>
                  <li>✅ Financial accounts</li>
                </ul>
              </div>
              
              <p className="text-muted-foreground">
                You're all ready to start managing your finances! Head to your dashboard to explore all the features.
              </p>
            </div>

            {/* Action button */}
            <div className="flex justify-center pt-4">
              <Button 
                onClick={handleGoToDashboard}
                className="px-8 bg-primary hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                size="lg"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            You can always update your information later from the dashboard settings
          </p>
        </div>
      </div>
    </div>
  );
}
