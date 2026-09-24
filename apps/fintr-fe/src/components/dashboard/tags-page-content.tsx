"use client";

import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import TagList from "@/components/dashboard/tag-list";
import { useTransactionTags } from "@/hooks/async/useTransactionTags";

export function TagsPageContent() {
  const searchParams = useSearchParams();
  const highlightTagId = searchParams.get("tagId") ?? undefined;
  const {
    tags,
    createTag,
    updateTag,
    deleteTag,
    isLoading,
    isError,
    refetch,
    toggleDefaultTag,
    generateStyleImage,
    assignStyleImage,
    isCreating,
    isUpdating,
    isDeleting,
    isTogglingDefault,
    isGeneratingStyleImage,
    isAssigningStyleImage,
  } = useTransactionTags();

  return (
    <Card className="border-0 bg-transparent px-0 shadow-none">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-2xl text-primary">Tags</CardTitle>
        <CardDescription>
          Create colored tags for trips, projects, and other cross-category labels.
          A default tag is added automatically to new expenses, income, and transfers.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="medium" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
            <p>Could not load tags. Please try again.</p>
            <button
              type="button"
              className="mt-3 text-sm font-medium underline"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <TagList
            tags={tags}
            highlightTagId={highlightTagId}
            onAdd={async (name, color, stylePresetKey) => {
              await createTag({ name, color, stylePresetKey });
              toast.success("Tag created");
            }}
            onUpdate={async (tagId, updateData) => {
              await updateTag({ tagId, updateData });
              toast.success("Tag updated");
            }}
            onDelete={async (tagId) => {
              await deleteTag(tagId);
              toast.success("Tag deleted");
            }}
            onToggleDefault={async (tagId) => {
              const updated = await toggleDefaultTag(tagId);
              toast.success(
                updated.isDefault
                  ? "Default tag set. New expenses, income, and transfers will include it."
                  : "Default tag unset",
              );
            }}
            onGenerateStyleImage={generateStyleImage}
            onAssignStyleImage={assignStyleImage}
            isLoading={isCreating || isUpdating || isDeleting || isTogglingDefault}
            isGeneratingStyleImage={isGeneratingStyleImage}
            isAssigningStyleImage={isAssigningStyleImage}
          />
        )}
      </CardContent>
    </Card>
  );
}
