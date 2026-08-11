"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TagFilterComboBox } from "@/components/ui/tag-filter-combobox";
import { Label } from "@/components/ui/label";
import type { TransactionTag } from "@/types/transactionTagTypes";
import { TAG_COLOR_PALETTE } from "@/utils/categoryAppearance";

type TagMultiPickerProps = {
  tags: TransactionTag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<TransactionTag | void>;
  disabled?: boolean;
  label?: string;
};

export const TagMultiPicker: React.FC<TagMultiPickerProps> = ({
  tags,
  value,
  onChange,
  onCreateTag,
  disabled = false,
  label = "Tags",
}) => {
  const [pendingName, setPendingName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  const normalizedTags = useMemo(() => tags, [tags]);

  const handleCreate = async () => {
    const trimmed = pendingName.trim();
    if (!trimmed || !onCreateTag) {
      return;
    }

    const exists = normalizedTags.some(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      const existing = normalizedTags.find(
        (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing && !value.includes(existing.id)) {
        onChange([...value, existing.id]);
      }
      setPendingName("");
      return;
    }

    setIsCreating(true);
    try {
      const seed = trimmed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const color = TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length];
      const created = await onCreateTag(trimmed, color);
      if (created?.id) {
        onChange([...value, created.id]);
      }
      setPendingName("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <TagFilterComboBox
        tags={normalizedTags}
        values={value}
        onValuesChange={onChange}
        disabled={disabled || isCreating}
        placeholder="Search or select tags"
        chipVariant="banner"
      />
      {onCreateTag && (
        <div className="flex gap-2">
          <input
            type="text"
            value={pendingName}
            onChange={(event) => setPendingName(event.target.value)}
            placeholder="New tag name"
            disabled={disabled || isCreating}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isCreating || !pendingName.trim()}
            onClick={handleCreate}
          >
            Add
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Optional labels for trips or projects — use tags instead of creating extra categories.
      </p>
    </div>
  );
};
