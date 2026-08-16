"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, List, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TransactionTag } from "@/types/transactionTagTypes";
import {
  buildInsightsTagFilterHref,
  buildTagsPageHref,
  buildTransactionsTagFilterHref,
} from "@/utils/detailHrefs";

type TagDestinationDialogProps = {
  tag: Pick<TransactionTag, "id" | "name"> | null;
  onClose: () => void;
};

export function TagDestinationDialog({
  tag,
  onClose,
}: TagDestinationDialogProps) {
  const router = useRouter();

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Dialog
      open={Boolean(tag)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Open {tag?.name ?? "tag"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Choose where to view this tag.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={() => tag && go(buildTransactionsTagFilterHref(tag.id))}
          >
            <List className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col items-start">
              <span>Transactions</span>
              <span className="text-xs font-normal text-muted-foreground">
                Filter the list to this tag
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={() => tag && go(buildInsightsTagFilterHref(tag.id))}
          >
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col items-start">
              <span>Dashboard</span>
              <span className="text-xs font-normal text-muted-foreground">
                Filter insights to this tag
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={() => tag && go(buildTagsPageHref(tag.id))}
          >
            <Tags className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col items-start">
              <span>Tags</span>
              <span className="text-xs font-normal text-muted-foreground">
                Open this tag in settings
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
