"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Check, Plus, Search, Store, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { useCloseOnPopStateWhenOpen } from "@/hooks/useCloseOnPopStateWhenOpen";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const MERCHANT_SELECTOR_HISTORY_KEY = "__fintrMerchantSelector";
const BELOW_MD_SHEET_QUERY = "(max-width: 767px)";

export type MerchantOption = {
  id: string;
  fullName: string;
  photoUrl?: string | null;
};

const bottomSheetClassName = cn(
  "flex h-[80dvh] min-h-[80dvh] max-h-[80dvh] flex-col overflow-hidden rounded-none rounded-t-3xl",
  "border-x-0 border-b-0 border-t bg-background p-0 shadow-2xl",
  "w-full min-w-full max-w-none",
  "z-[130]",
);

type MerchantSelectorContentProps = {
  open: boolean;
  value: string;
  merchants: MerchantOption[];
  loading: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelect: (merchant: MerchantOption) => void;
  onClose: () => void;
  title: string;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  notFoundPrefix: string;
  createLabel: (name: string) => string;
  onAddMerchant: () => void;
  onQuickCreate: (name: string) => void;
  onOpenCreationPanel: (seed: string) => void;
  isCreating: boolean;
  showDragHandle?: boolean;
};

function MerchantSelectorContent({
  open,
  value,
  merchants,
  loading,
  searchQuery,
  onSearchQueryChange,
  onSelect,
  onClose,
  title,
  placeholder,
  emptyTitle,
  emptyDescription,
  addLabel,
  notFoundPrefix,
  createLabel,
  onAddMerchant,
  onQuickCreate,
  onOpenCreationPanel,
  isCreating,
  showDragHandle = false,
}: MerchantSelectorContentProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      onSearchQueryChange("");
    }
  }, [onSearchQueryChange, open]);

  const filteredMerchants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return merchants;

    return merchants.filter((merchant) =>
      merchant.fullName.toLowerCase().includes(query),
    );
  }, [merchants, searchQuery]);

  const handleSelect = useCallback(
    (merchant: MerchantOption) => {
      onSelect(merchant);
      onClose();
    },
    [onClose, onSelect],
  );

  const showEmptyCatalog =
    !loading && !searchQuery.trim() && filteredMerchants.length === 0;
  const showNotFound =
    !loading && searchQuery.trim().length > 0 && filteredMerchants.length === 0;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        showDragHandle ? "h-full flex-1" : "flex-1",
      )}
    >
      <div
        className={cn(
          "shrink-0 px-4",
          showDragHandle ? "pt-2" : "pt-4",
        )}
      >
        {showDragHandle ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25" />
        ) : null}

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-primary">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
            onClick={onClose}
            aria-label="Close merchant selector"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(
              "h-11 rounded-full border-0 bg-muted/60 pl-10 pr-4",
              "focus-visible:ring-1 focus-visible:ring-ring",
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
          "px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          !showDragHandle && "max-h-80",
        )}
      >
        {loading && filteredMerchants.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : showEmptyCatalog ? (
          <div className="space-y-3 px-2 py-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  "bg-primary/10 text-primary",
                )}
                aria-hidden
              >
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {emptyDescription}
                </p>
              </div>
            </div>
            <Button type="button" size="sm" className="w-full" onClick={onAddMerchant}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {addLabel}
            </Button>
          </div>
        ) : showNotFound ? (
          <div className="space-y-3 px-2 py-4">
            <p className="text-sm text-muted-foreground">
              {notFoundPrefix}{" "}
              <span className="font-medium text-foreground">"{searchQuery}"</span>
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => onQuickCreate(searchQuery)}
                disabled={isCreating}
              >
                {isCreating ? "Saving…" : createLabel(searchQuery)}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => onOpenCreationPanel(searchQuery)}
              >
                Enter details manually
              </Button>
            </div>
          </div>
        ) : (
          <ul className="w-full space-y-0.5">
            {filteredMerchants.map((merchant) => {
              const isSelected = value === merchant.fullName;

              return (
                <li key={merchant.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(merchant)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left",
                      "transition-colors hover:bg-muted/60",
                      isSelected && "bg-muted/40",
                    )}
                  >
                    <MerchantAvatar
                      name={merchant.fullName}
                      photoUrl={merchant.photoUrl}
                      size={40}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {merchant.fullName}
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export interface MerchantSelectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  value: string;
  merchants: MerchantOption[];
  loading: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelect: (merchant: MerchantOption) => void;
  title: string;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  notFoundPrefix: string;
  createLabel: (name: string) => string;
  onAddMerchant: () => void;
  onQuickCreate: (name: string) => void;
  onOpenCreationPanel: (seed: string) => void;
  isCreating: boolean;
}

export function MerchantSelectorSheet({
  open,
  onOpenChange,
  trigger,
  value,
  merchants,
  loading,
  searchQuery,
  onSearchQueryChange,
  onSelect,
  title,
  placeholder,
  emptyTitle,
  emptyDescription,
  addLabel,
  notFoundPrefix,
  createLabel,
  onAddMerchant,
  onQuickCreate,
  onOpenCreationPanel,
  isCreating,
}: MerchantSelectorSheetProps) {
  useCloseOnPopStateWhenOpen(open, onOpenChange, MERCHANT_SELECTOR_HISTORY_KEY);

  const useBottomSheet = useMediaQuery(BELOW_MD_SHEET_QUERY);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const content = (
    <MerchantSelectorContent
      open={open}
      value={value}
      merchants={merchants}
      loading={loading}
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      onSelect={onSelect}
      onClose={handleClose}
      title={title}
      placeholder={placeholder}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      addLabel={addLabel}
      notFoundPrefix={notFoundPrefix}
      createLabel={createLabel}
      onAddMerchant={onAddMerchant}
      onQuickCreate={onQuickCreate}
      onOpenCreationPanel={onOpenCreationPanel}
      isCreating={isCreating}
      showDragHandle={useBottomSheet}
    />
  );

  if (useBottomSheet) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          overlayClassName="z-[125]"
          onOverlayClick={handleClose}
          className={bottomSheetClassName}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(32rem,calc(100vh-4rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}
