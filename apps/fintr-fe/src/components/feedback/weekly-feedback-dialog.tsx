"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AxiosInstance } from "axios";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_AREA_OPTIONS,
  type FeedbackAreaId,
} from "@/config/weekly-feedback";
import { createProductPulseFeedback } from "@/services/product-pulse/mutations";

const NOTES_MAX = 2000;

type SubmitWeeklyFeedbackPayload = {
  likedAreas: FeedbackAreaId[];
  improveAreas: FeedbackAreaId[];
  notes?: string;
};

type WeeklyFeedbackDialogProps = {
  api: AxiosInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const toggleInSet = (set: Set<FeedbackAreaId>, id: FeedbackAreaId): Set<FeedbackAreaId> => {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
};

const AreaChipGroup = ({
  title,
  description,
  selected,
  onToggle,
  sectionTestId,
}: {
  title: string;
  description: string;
  selected: Set<FeedbackAreaId>;
  onToggle: (id: FeedbackAreaId) => void;
  sectionTestId: string;
}) => (
  <div className="space-y-2" data-testid={sectionTestId}>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">{title}</p>
      <p className="text-sm text-primary/70">{description}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {FEEDBACK_AREA_OPTIONS.map((opt) => {
        const isOn = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              isOn
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

export const WeeklyFeedbackDialog = ({
  api,
  open,
  onOpenChange,
}: WeeklyFeedbackDialogProps) => {
  const reduceMotion = useReducedMotion();
  const [likes, setLikes] = useState<Set<FeedbackAreaId>>(() => new Set());
  const [improve, setImprove] = useState<Set<FeedbackAreaId>>(() => new Set());
  const [notes, setNotes] = useState("");

  const resetForm = useCallback(() => {
    setLikes(new Set());
    setImprove(new Set());
    setNotes("");
  }, []);

  const mutation = useMutation({
    mutationFn: (payload: SubmitWeeklyFeedbackPayload) =>
      createProductPulseFeedback(api, {
        likedAreas: payload.likedAreas,
        improveAreas: payload.improveAreas,
        notes: payload.notes,
      }),
    onSuccess: () => {
      toast.success("Thanks — your feedback helps us improve Fintr.");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: { details?: unknown } } } };
      const details = ax.response?.data?.error?.details as Record<string, unknown> | undefined;
      const periodErr =
        details &&
        typeof details === "object" &&
        ("periodKey" in details || "period_key" in details);
      const msg = periodErr
        ? "You already sent feedback for this week."
        : "Could not send feedback. Please try again.";
      toast.error(msg);
    },
  });

  const canSubmit = useMemo(() => {
    const n = notes.trim();
    return likes.size > 0 || improve.size > 0 || n.length > 0;
  }, [likes, improve, notes]);

  const handleNotes = useCallback((value: string) => {
    if (value.length <= NOTES_MAX) {
      setNotes(value);
    }
  }, []);

  const handleSkip = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[min(90dvh,640px)] overflow-y-auto border-0 bg-background p-0 sm:max-w-lg",
          "shadow-xl ring-1 ring-primary/10"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500/80 via-primary to-amber-500/70" />
        {open ? (
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 p-6 pt-7"
          >
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-primary">
                  How&apos;s Fintr going this week?
                </DialogTitle>
                <DialogDescription className="text-base text-primary/75">
                  Pick what&apos;s working for you and where we should focus next. Skip anytime — no pressure.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <AreaChipGroup
                  title="What you like"
                  description="What should we keep investing in?"
                  selected={likes}
                  onToggle={(id) => setLikes((s) => toggleInSet(s, id))}
                  sectionTestId="weekly-feedback-likes"
                />
                <AreaChipGroup
                  title="Needs improvement"
                  description="Where should we polish or fix first?"
                  selected={improve}
                  onToggle={(id) => setImprove((s) => toggleInSet(s, id))}
                  sectionTestId="weekly-feedback-improve"
                />
                <div className="space-y-2">
                  <label htmlFor="weekly-feedback-notes" className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                    Anything else? (optional)
                  </label>
                  <Textarea
                    id="weekly-feedback-notes"
                    value={notes}
                    onChange={(e) => handleNotes(e.target.value)}
                    placeholder="Short context helps — e.g. device, flow, or what you expected."
                    rows={3}
                    className="resize-none border-primary/15 bg-primary/[0.03] text-primary placeholder:text-primary/40"
                  />
                  <p className="text-right text-xs text-primary/50">
                    {notes.length}/{NOTES_MAX}
                  </p>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
                <Button
                  type="button"
                  className="w-full rounded-full"
                  disabled={!canSubmit || mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      likedAreas: [...likes],
                      improveAreas: [...improve],
                      notes: notes.trim() || undefined,
                    })
                  }
                >
                  {mutation.isPending ? "Sending…" : "Send feedback"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-primary/70 hover:text-primary"
                  onClick={handleSkip}
                >
                  Not now
                </Button>
              </DialogFooter>
            </motion.div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
