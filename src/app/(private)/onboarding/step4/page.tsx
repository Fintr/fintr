"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportWizard } from "@/components/import/import-wizard";
import { ImportResults } from "@/components/import/import-results";
import { ArrowLeft } from "lucide-react";

export default function OnboardingStep4() {
  const router = useRouter();
  const [importId, setImportId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleImportComplete = (id: string) => {
    if (id) {
      setImportId(id);
      setShowResults(true);
    } else {
      // User skipped import, go to completed
      router.push('/onboarding/completed');
    }
  };

  const handleBack = () => {
    router.push('/onboarding/step3');
  };

  const handleContinue = () => {
    router.push('/onboarding/completed');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 4 of 4</span>
            <span>Import Data</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-full"></div>
          </div>
        </div>

        {showResults && importId ? (
          <div className="space-y-4">
            <ImportResults importId={importId} />
            <div className="flex justify-end">
              <Button onClick={handleContinue} className="bg-teal-600 hover:bg-teal-700">
                Continue to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <ImportWizard
              context="onboarding"
              onImportComplete={handleImportComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

