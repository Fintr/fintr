"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import {
  MerchantOption,
  MerchantSelectorSheet,
} from "@/components/ui/merchant-selector-sheet";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";
import { cn } from "@/lib/utils";

export interface MerchantPickerProps {
  value: string;
  onChange: (fullName: string) => void;
  onFetchMerchants: (query: string) => Promise<MerchantOption[]>;
  label?: string;
  optionalLabel?: string;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  notFoundPrefix: string;
  createLabel: (name: string) => string;
  onAddMerchant: () => void;
  onQuickCreate: (name: string, onSuccess?: () => void) => void;
  onOpenCreationPanel: (seed: string) => void;
  isCreating?: boolean;
  className?: string;
  disabled?: boolean;
}

export function MerchantPicker({
  value,
  onChange,
  onFetchMerchants,
  label,
  optionalLabel = "Optional",
  placeholder = "Select merchant",
  title = "Select Merchant",
  searchPlaceholder = "Search merchants…",
  emptyTitle,
  emptyDescription,
  addLabel,
  notFoundPrefix,
  createLabel,
  onAddMerchant,
  onQuickCreate,
  onOpenCreationPanel,
  isCreating = false,
  className,
  disabled = false,
}: MerchantPickerProps) {
  const [open, setOpen] = useState(false);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fetchRequestIdRef = useRef(0);
  const merchantsRef = useRef(merchants);
  merchantsRef.current = merchants;

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.fullName === value) ?? null,
    [merchants, value],
  );

  const loadMerchants = useCallback(
    async (query: string) => {
      const requestId = ++fetchRequestIdRef.current;
      const trimmedQuery = query.trim();
      const hasCachedList =
        merchantsRef.current.length > 0 && trimmedQuery.length === 0;

      if (!hasCachedList) {
        setLoading(true);
      }

      try {
        const result = await onFetchMerchants(query);
        if (requestId !== fetchRequestIdRef.current) return;
        setMerchants(result);
      } catch (error) {
        console.error("Failed to fetch merchants:", error);
        if (requestId === fetchRequestIdRef.current) {
          setMerchants([]);
        }
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [onFetchMerchants],
  );

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      loadMerchants(searchQuery);
    }, searchQuery.trim() ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadMerchants, open, searchQuery]);

  useEffect(() => {
    if (!value || selectedMerchant) return;
    loadMerchants(value);
  }, [loadMerchants, selectedMerchant, value]);

  const handleSelect = useCallback(
    (merchant: MerchantOption) => {
      onChange(merchant.fullName);
    },
    [onChange],
  );

  const displayLabel = selectedMerchant ? (
    <span className="flex min-w-0 items-center gap-2">
      <MerchantAvatar
        name={selectedMerchant.fullName}
        photoUrl={selectedMerchant.photoUrl}
        size={20}
      />
      <span className="truncate">{selectedMerchant.fullName}</span>
    </span>
  ) : value ? (
    <span className="flex min-w-0 items-center gap-2">
      <MerchantAvatar name={value} size={20} />
      <span className="truncate">{value}</span>
    </span>
  ) : (
    placeholder
  );

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <Label className="text-sm font-medium text-primary">{label}</Label>
          {optionalLabel ? (
            <span className="text-xs text-muted-foreground">{optionalLabel}</span>
          ) : null}
        </div>
      ) : null}

      <MerchantSelectorSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        merchants={merchants}
        loading={loading}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSelect={handleSelect}
        title={title}
        placeholder={searchPlaceholder}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        addLabel={addLabel}
        notFoundPrefix={notFoundPrefix}
        createLabel={createLabel}
        onAddMerchant={() => {
          setOpen(false);
          onAddMerchant();
        }}
        onQuickCreate={(name) => {
          onQuickCreate(name, () => setOpen(false));
        }}
        onOpenCreationPanel={(seed) => {
          setOpen(false);
          onOpenCreationPanel(seed);
        }}
        isCreating={isCreating}
        trigger={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between px-3 font-normal",
              formControlInteractiveSurfaceClassName,
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
    </div>
  );
}
