"use client";

import { useState } from "react";
import type { AxiosInstance } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRO_FEATURES } from "@/lib/pro-features";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRO_ACCESS_QUERY_KEY } from "@/hooks/async/useProAccess";
import type { ProAccess } from "@/services/finance/pro-access";

type ProGrantThankYouDialogProps = {
  api: AxiosInstance;
  open: boolean;
  expiresAt: string | null;
  onAcknowledged: () => void;
};

export const formatProGrantDate = (expiresAt: string): string => {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const ProGrantThankYouDialog = ({
  api,
  open,
  expiresAt,
  onAcknowledged,
}: ProGrantThankYouDialogProps) => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const through = expiresAt ? formatProGrantDate(expiresAt) : "";

  const handleAcknowledge = async () => {
    setIsSaving(true);
    try {
      await api.post("/finance/pro_grant_acknowledgement");
      queryClient.setQueryData<ProAccess>(PRO_ACCESS_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          grantNotice: current.grantNotice
            ? { ...current.grantNotice, pending: false }
            : current.grantNotice,
        };
      });
      onAcknowledged();
    } catch {
      toast.error("Couldn't save that. We'll show this again next time you open Fintr.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void handleAcknowledge();
        }
      }}
    >
      <DialogContent>
        <img
          src="/pro-grant-thank-you.png"
          alt="A calm woman with glasses sitting on a quiet hill"
          className="w-full rounded-lg"
        />
        <DialogHeader>
          <DialogTitle className="text-primary">Thank you for using Fintr</DialogTitle>
          <DialogDescription>
            You&apos;ve been with us, and that means a lot. We&apos;re giving you 1 year of Fintr Pro.
            {through ? ` It's active through ${through}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {PRO_FEATURES.map((feature) => (
            <li key={feature.key} className="flex items-start gap-2">
              {feature.available ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>
                <span className="font-medium">{feature.name}</span>
                {feature.available ? null : (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    Soon
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={handleAcknowledge} disabled={isSaving}>
            {isSaving ? "Saving…" : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
