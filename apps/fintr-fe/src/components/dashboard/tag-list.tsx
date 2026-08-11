"use client";

import React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { TagChip } from "@/components/ui/tag-chip";
import { TagStylePreview } from "@/components/dashboard/tag-style-preview";
import TagFormDialog from "@/components/dashboard/tag-form-dialog";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { TransactionTag } from "@/types/transactionTagTypes";

type TagListProps = {
  tags: TransactionTag[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (
    tagId: string,
    updateData: { name: string; color: string },
  ) => Promise<void>;
  onDelete: (tagId: string) => Promise<void>;
  onToggleDefault: (tagId: string) => Promise<void>;
  onGenerateStyleImage?: (
    tagId: string,
    prompt: string,
  ) => Promise<TransactionTag>;
  isLoading?: boolean;
  isGeneratingStyleImage?: boolean;
};

const TagList: React.FC<TagListProps> = ({
  tags,
  onAdd,
  onUpdate,
  onDelete,
  onToggleDefault,
  onGenerateStyleImage,
  isLoading = false,
  isGeneratingStyleImage = false,
}) => {
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingTag, setEditingTag] = React.useState<TransactionTag | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const filteredTags = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return tags;
    }

    return tags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [debouncedSearch, tags]);

  const addTagDialog = (
    <TagFormDialog
      trigger={
        <Button
          type="button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add tag
        </Button>
      }
      open={addOpen}
      onOpenChange={setAddOpen}
      onAdd={onAdd}
      isLoading={isLoading}
      onGenerateStyleImage={onGenerateStyleImage}
      isGeneratingStyleImage={isGeneratingStyleImage}
    />
  );

  if (tags.length === 0) {
    return (
      <div className="space-y-6 px-2 sm:px-0">
        <div className="flex flex-col items-center px-2 py-6 text-center sm:px-4 sm:py-8">
          <h3 className="text-base font-semibold text-foreground sm:text-lg">
            No tags yet
          </h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Create tags for trips, projects, or anything that cuts across categories.
          </p>
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            Tap a tag to set it as the default for new transactions.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6 rounded-full border-primary px-6 text-primary hover:bg-primary/5"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add tag
          </Button>
        </div>

        <TagFormDialog
          trigger={<span className="hidden" />}
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={onAdd}
          isLoading={isLoading}
          onGenerateStyleImage={onGenerateStyleImage}
          isGeneratingStyleImage={isGeneratingStyleImage}
        />

        {editingTag && (
          <TagFormDialog
            tag={editingTag}
            trigger={<span className="hidden" />}
            open={Boolean(editingTag)}
            onOpenChange={(open) => {
              if (!open) {
                setEditingTag(null);
              }
            }}
            onUpdate={async (tagId, updateData) => {
              await onUpdate(tagId, updateData);
              setEditingTag(null);
            }}
            isLoading={isLoading}
            onGenerateStyleImage={onGenerateStyleImage}
            isGeneratingStyleImage={isGeneratingStyleImage}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tap a tag to set or unset it as the default for new transactions.
      </p>

      <SearchField
        type="search"
        placeholder="Search tags"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        aria-label="Search tags"
        autoComplete="off"
      />

      {filteredTags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No tags match</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Try a different name, or clear the search to see all tags.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-3",
                tag.isDefault && "border-primary/40 bg-primary/5",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-pressed={tag.isDefault}
                aria-label={
                  tag.isDefault
                    ? `Unset ${tag.name} as default tag`
                    : `Set ${tag.name} as default tag`
                }
                onClick={() => onToggleDefault(tag.id)}
              >
                {tag.styleImageUrl ? (
                  <TagStylePreview
                    tag={tag}
                    className="max-w-[16rem] border-0 shadow-none"
                  />
                ) : (
                  <TagChip tag={tag} showDefaultBadge={tag.isDefault} variant="full" />
                )}
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Edit ${tag.name}`}
                  onClick={() => setEditingTag(tag)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  aria-label={`Delete ${tag.name}`}
                  onClick={() => onDelete(tag.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addTagDialog}

      {editingTag && (
        <TagFormDialog
          tag={editingTag}
          trigger={<span className="hidden" />}
          open={Boolean(editingTag)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingTag(null);
            }
          }}
          onUpdate={async (tagId, updateData) => {
            await onUpdate(tagId, updateData);
            setEditingTag(null);
          }}
          isLoading={isLoading}
          onGenerateStyleImage={onGenerateStyleImage}
          isGeneratingStyleImage={isGeneratingStyleImage}
        />
      )}
    </div>
  );
};

export default TagList;
