"use client";

import { useEffect, useRef, useState } from "react";
import type { AxiosInstance } from "axios";
import {
  isWeeklyFeedbackTestMode,
  markWeeklyFeedbackHandled,
  shouldShowWeeklyFeedbackPrompt,
} from "@/config/weekly-feedback";
import { WeeklyFeedbackDialog } from "@/components/feedback/weekly-feedback-dialog";

type WeeklyFeedbackPromptProps = {
  api: AxiosInstance;
  enabled: boolean;
};

export const WeeklyFeedbackPrompt = ({ api, enabled }: WeeklyFeedbackPromptProps) => {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let timeoutId: number | undefined;

    const arm = () => {
      if (!shouldShowWeeklyFeedbackPrompt() || openRef.current) {
        return;
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        if (!shouldShowWeeklyFeedbackPrompt() || openRef.current) {
          return;
        }
        setOpen(true);
      }, 2000);
    };

    arm();

    if (!isWeeklyFeedbackTestMode()) {
      return () => {
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    const intervalId = window.setInterval(arm, 8000);
    return () => {
      window.clearInterval(intervalId);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled]);

  return (
    <WeeklyFeedbackDialog
      api={api}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          markWeeklyFeedbackHandled();
        }
        setOpen(next);
      }}
    />
  );
};
