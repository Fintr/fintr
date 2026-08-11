"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import { ColorPalettePicker } from "@/components/ui/color-palette-picker";
import { TagStylePreview } from "@/components/dashboard/tag-style-preview";
import { TAG_COLOR_PALETTE } from "@/utils/categoryAppearance";
import { useHasPaidSubscription } from "@/hooks/async/useSubscriptions";
import { toast } from "sonner";
import type { TransactionTag } from "@/types/transactionTagTypes";

function defaultStylePrompt(tagName: string): string {
  const label = tagName.trim() || "this tag";
  return `Scenic flat illustration evoking "${label}" — place, season, or mood. Soft colors, simple shapes.`;
}

interface TagFormDialogProps {
  tag?: TransactionTag;
  onUpdate?: (
    tagId: string,
    updateData: { name: string; color: string },
  ) => Promise<void>;
  onAdd?: (name: string, color: string) => Promise<void>;
  onGenerateStyleImage?: (
    tagId: string,
    prompt: string,
  ) => Promise<TransactionTag>;
  isLoading?: boolean;
  isGeneratingStyleImage?: boolean;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TagFormDialog: React.FC<TagFormDialogProps> = ({
  tag,
  onUpdate,
  onAdd,
  onGenerateStyleImage,
  isLoading = false,
  isGeneratingStyleImage = false,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => controlledOnOpenChange?.(open)
    : setInternalOpen;

  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? TAG_COLOR_PALETTE[0]);
  const [styleImageUrl, setStyleImageUrl] = useState(tag?.styleImageUrl);
  const [stylePrompt, setStylePrompt] = useState("");
  const [showStylePrompt, setShowStylePrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasPaidSubscription, isLoading: isLoadingSubscription } =
    useHasPaidSubscription();

  useEffect(() => {
    if (!isOpen) {
      setShowStylePrompt(false);
      return;
    }

    setName(tag?.name ?? "");
    setColor(tag?.color ?? TAG_COLOR_PALETTE[0]);
    setStyleImageUrl(tag?.styleImageUrl);
    setStylePrompt(defaultStylePrompt(tag?.name ?? ""));
    setShowStylePrompt(false);
  }, [isOpen, tag?.name, tag?.color, tag?.styleImageUrl]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Tag name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (tag && onUpdate) {
        await onUpdate(tag.id, { name: trimmedName, color });
      } else if (onAdd) {
        await onAdd(trimmedName, color);
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save tag:", error);
      toast.error("Failed to save tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStylePrompt = () => {
    setStylePrompt(defaultStylePrompt(name));
    setShowStylePrompt(true);
  };

  const handleGenerateStyle = async () => {
    if (!tag?.id || !onGenerateStyleImage) {
      return;
    }

    const trimmedPrompt = stylePrompt.trim();
    if (!trimmedPrompt) {
      toast.error("Describe the illustration you want");
      return;
    }

    try {
      const updated = await onGenerateStyleImage(tag.id, trimmedPrompt);
      setStyleImageUrl(updated.styleImageUrl);
      setShowStylePrompt(false);
      toast.success("Tag style generated");
    } catch (error: unknown) {
      console.error("Failed to generate tag style:", error);
      const apiError = error as {
        error?: { message?: string; details?: Record<string, string[]> };
        message?: string;
      };
      const details = apiError?.error?.details;
      const detailMessage =
        details?.prompt?.[0] ??
        details?.subscription?.[0] ??
        details?.image?.[0] ??
        apiError?.error?.message ??
        apiError?.message;

      toast.error(detailMessage ?? "Could not generate tag style");
    }
  };

  const previewTag = {
    name: name.trim() || "Tag name",
    color,
    styleImageUrl,
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">
            {tag ? "Edit tag" : "Create tag"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Japan 2026"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <ColorPalettePicker
            color={color}
            onColorChange={setColor}
            disabled={isSubmitting || isLoading}
          />

          {tag?.id ? (
            <div className="space-y-2">
              <Label>Styled tag preview</Label>
              <TagStylePreview tag={previewTag} />
              <p className="text-xs text-muted-foreground">
                Generate an AI illustration that styles this tag in lists and filters.
              </p>

              {isLoadingSubscription ? null : hasPaidSubscription ? (
                showStylePrompt ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    <Label htmlFor="tag-style-prompt">Your prompt</Label>
                    <ExpandableTextarea
                      id="tag-style-prompt"
                      value={stylePrompt}
                      onChange={(event) => setStylePrompt(event.target.value)}
                      placeholder="e.g. Autumn in Japan with red momiji, torii gate, misty mountains"
                      disabled={isSubmitting || isLoading || isGeneratingStyleImage}
                      className="max-h-none text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Describe scenery, mood, or symbols. We add style rules so it fits the tag pill.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        disabled={isSubmitting || isLoading || isGeneratingStyleImage}
                        onClick={() => setShowStylePrompt(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={
                          isSubmitting ||
                          isLoading ||
                          isGeneratingStyleImage ||
                          !stylePrompt.trim()
                        }
                        onClick={handleGenerateStyle}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isGeneratingStyleImage ? "Generating…" : "Generate"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={
                      isSubmitting ||
                      isLoading ||
                      isGeneratingStyleImage ||
                      !name.trim()
                    }
                    onClick={handleOpenStylePrompt}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {styleImageUrl ? "Regenerate style" : "Generate style"}
                  </Button>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-sm">
                  <p className="font-medium text-foreground">Pro feature</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upgrade to a paid plan to generate custom tag styles.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-1 h-auto p-0 text-primary"
                    asChild
                  >
                    <Link href="/dashboard/subscriptions">View plans</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isLoading}
          >
            {tag ? "Save changes" : "Create tag"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TagFormDialog;
