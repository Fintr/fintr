"use client";

import { FintrLogo } from "@/components/brand/fintr-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMaintenanceMessage,
  getMaintenanceTitle,
} from "@/lib/maintenance-mode";
import { Wrench } from "lucide-react";

export function MaintenanceScreen() {
  const { logout } = useAuth();
  const title = getMaintenanceTitle();
  const message = getMaintenanceMessage();

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-6 py-12"
      data-testid="maintenance-screen"
    >
      <div className="text-center space-y-8 max-w-md w-full">
        <div className="flex justify-center">
          <FintrLogo className="h-10 w-auto" />
        </div>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Wrench
            className="h-7 w-7 text-primary dark:text-primary-dark-mode"
            aria-hidden
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => logout()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
