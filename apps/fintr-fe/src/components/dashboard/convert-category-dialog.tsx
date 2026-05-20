"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  convertCategoryHierarchy,
  previewCategoryConversion,
} from "@/services/transactions/categories/mutation";
import {
  CategoryConversionPreview,
  CategoryConversionType,
} from "@/types/categoryConversionTypes";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type ConvertCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string };
  conversionType: CategoryConversionType;
  kind: "expense" | "income";
  rootCategories: TransactionCategory[];
  currencyCode?: string;
  onConverted: (redirectParentId: string) => void;
};

const ConvertCategoryDialog: React.FC<ConvertCategoryDialogProps> = ({
  open,
  onOpenChange,
  category,
  conversionType,
  kind,
  rootCategories,
  currencyCode = "PHP",
  onConverted,
}) => {
  const { api } = useAuthApi();
  const [newParentId, setNewParentId] = useState<string>("");
  const [preview, setPreview] = useState<CategoryConversionPreview | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentOptions = useMemo(
    () => rootCategories.filter((root) => root.id !== category.id),
    [rootCategories, category.id],
  );

  const needsParentPicker =
    conversionType === "to_subcategory" && parentOptions.length > 0;

  const canLoadPreview =
    conversionType === "to_parent" ||
    (conversionType === "to_subcategory" && Boolean(newParentId));

  useEffect(() => {
    if (!open) {
      setNewParentId("");
      setPreview(null);
      setError(null);
      return;
    }

    if (conversionType === "to_subcategory" && parentOptions.length === 1) {
      setNewParentId(parentOptions[0].id);
    }
  }, [open, conversionType, parentOptions]);

  useEffect(() => {
    if (!open || !canLoadPreview) {
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      setError(null);

      try {
        const data = await previewCategoryConversion(api, category.id, {
          conversionType,
          newParentId:
            conversionType === "to_subcategory" ? newParentId : null,
        });

        if (!cancelled) {
          setPreview(data);
        }
      } catch (previewError: unknown) {
        if (!cancelled) {
          const message =
            (previewError as { error?: { message?: string } })?.error
              ?.message ?? "Could not load transfer preview.";
          setError(message);
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [api, open, canLoadPreview, category.id, conversionType, newParentId]);

  const title =
    conversionType === "to_subcategory"
      ? `Make "${category.name}" a subcategory`
      : `Make "${category.name}" a top-level category`;

  const description =
    conversionType === "to_subcategory"
      ? "Transactions and budgets using this category will be moved under the parent you choose."
      : "This subcategory will become its own category. Transactions will no longer be grouped under its parent.";

  const handleConfirm = async () => {
    if (!canLoadPreview) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await convertCategoryHierarchy(api, category.id, {
        conversionType,
        newParentId:
          conversionType === "to_subcategory" ? newParentId : null,
      });

      toast.success(
        conversionType === "to_subcategory"
          ? `"${category.name}" is now a subcategory`
          : `"${category.name}" is now a top-level category`,
      );
      onOpenChange(false);
      onConverted(result.redirectParentId);
    } catch (convertError: unknown) {
      const details = (convertError as { error?: { details?: Record<string, string> } })
        ?.error?.details;
      const message =
        details?.category ??
        details?.new_parent_id ??
        (convertError as { error?: { message?: string } })?.error?.message ??
        "Conversion failed.";
      setError(String(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conversionType === "to_subcategory" ? (
            <div className="space-y-2">
              <Label htmlFor="new-parent-category">Parent category</Label>
              {parentOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add another {kind} category first to use as the parent.
                </p>
              ) : (
                <Select value={newParentId} onValueChange={setNewParentId}>
                  <SelectTrigger id="new-parent-category">
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <LoadingSpinner size="small" />
              <span className="ml-2 text-sm">Calculating transfers…</span>
            </div>
          ) : null}

          {preview && !isLoadingPreview ? (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
              <p className="font-medium text-foreground">
                {preview.transactionCount === 0 && preview.budgetCount === 0
                  ? "Nothing will be reassigned."
                  : "The following will be reassigned:"}
              </p>
              {preview.transactionCount > 0 ? (
                <ul className="space-y-1.5 text-muted-foreground">
                  <li>
                    {preview.transactionCount} transaction
                    {preview.transactionCount === 1 ? "" : "s"}
                  </li>
                  {preview.incomeCount > 0 ? (
                    <li>
                      Income: {formatCurrency(preview.incomeTotal, currencyCode)}{" "}
                      ({preview.incomeCount})
                    </li>
                  ) : null}
                  {preview.expenseCount > 0 ? (
                    <li>
                      Expense: {formatCurrency(preview.expenseTotal, currencyCode)}{" "}
                      ({preview.expenseCount})
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {preview.budgetCount > 0 ? (
                <p className="text-muted-foreground">
                  {preview.budgetCount} monthly budget
                  {preview.budgetCount === 1 ? "" : "s"} will be updated.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-900 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              isLoadingPreview ||
              !canLoadPreview ||
              (conversionType === "to_subcategory" &&
                parentOptions.length === 0)
            }
          >
            {isSubmitting ? "Updating…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertCategoryDialog;
