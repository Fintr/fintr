"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import {
  buildCategoryDetailHref,
  CategoryKind,
  categoryKindToEnum,
  findRootCategory,
} from "@/utils/categoryManagement";
import CategoryActionsMenu, {
  CategoryMenuItem,
} from "@/components/dashboard/category-actions-menu";
import CategoryFormDialog from "@/components/dashboard/category-form-dialog";
import DeleteCategoryDialog from "@/components/dashboard/delete-category-dialog";
import ConvertCategoryDialog from "@/components/dashboard/convert-category-dialog";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { CategoryConversionType } from "@/types/categoryConversionTypes";
import { CategoryBudgetSection } from "@/components/dashboard/category-budget-section";
import { CategoryDetailTransactions } from "@/components/dashboard/category-detail-transactions";
import { CategoryIconBadge } from "@/components/dashboard/category-icon-badge";

type CategoryDetailContentProps = {
  categoryId: string;
  kind: CategoryKind;
};

const CategoryDetailContent: React.FC<CategoryDetailContentProps> = ({
  categoryId,
  kind,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const currencyCode = currentSpace?.currency ?? "PHP";
  const categoryType = categoryKindToEnum(kind);

  const {
    expenseCategories,
    incomeCategories,
    isLoading,
    isError,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
  } = useTransactionCategories();

  const tree = kind === "income" ? incomeCategories : expenseCategories;
  const parent = useMemo(
    () => findRootCategory(tree, categoryId),
    [tree, categoryId],
  );

  const [editTarget, setEditTarget] = useState<CategoryMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryMenuItem | null>(
    null,
  );
  const [addSubcategoryOpen, setAddSubcategoryOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<CategoryMenuItem | null>(
    null,
  );
  const [conversionType, setConversionType] =
    useState<CategoryConversionType | null>(null);

  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ["transactionCategories"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  const handleCreate = async (
    name: string,
    type: CategoryTypeEnum,
    parentId?: string | null,
    appearance?: {
      icon: string;
      color: string;
    },
  ) => {
    await createCategoryMutation.mutateAsync({
      name,
      categoryType: type,
      parentId: parentId ?? null,
      icon: appearance?.icon,
      color: appearance?.color,
    });
    invalidateCategories();
  };

  const handleUpdate = async (
    id: string,
    updateData: {
      name: string;
      icon: string;
      color: string;
    },
  ) => {
    await updateCategoryMutation.mutateAsync({
      categoryId: id,
      updateData,
    });
    invalidateCategories();
  };

  const handleDelete = async (id: string) => {
    const response = await deleteCategoryMutation.mutateAsync(id);
    invalidateCategories();
    return response;
  };

  const openConversion = (
    item: CategoryMenuItem,
    type: CategoryConversionType,
  ) => {
    setConvertTarget(item);
    setConversionType(type);
  };

  const handleConverted = (redirectParentId: string) => {
    invalidateCategories();
    router.push(buildCategoryDetailHref(redirectParentId, kind));
  };

  if (isLoading && !parent) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-2 py-8 space-y-4">
        <p className="text-red-900">Failed to load categories.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/categories">
            Back to categories
          </Link>
        </Button>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="max-w-2xl mx-auto px-2 py-8 space-y-4">
        <p className="text-muted-foreground">Category not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/categories">
            Back to categories
          </Link>
        </Button>
      </div>
    );
  }

  const subcategories = parent.children ?? [];
  const kindLabel = kind === "income" ? "Income" : "Expense";

  return (
    <div className="max-w-2xl mx-auto px-2 pb-24 md:pb-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          <CategoryIconBadge
            icon={parent.icon}
            color={parent.color}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{kindLabel} category</p>
            <h1 className="text-2xl font-bold text-primary truncate">
              {parent.name}
            </h1>
          </div>
        </div>
        <CategoryActionsMenu
          item={{
            id: parent.id,
            name: parent.name,
            icon: parent.icon,
            color: parent.color,
          }}
          variant="parent"
          onEdit={(item) => setEditTarget(item)}
          onDelete={(item) => setDeleteTarget(item)}
          onAddSubcategory={() => setAddSubcategoryOpen(true)}
          onConvertToSubcategory={(item) =>
            openConversion(item, "to_subcategory")
          }
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Subcategories
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setAddSubcategoryOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>

        {subcategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-muted/20">
            No subcategories yet. Add one to organize transactions under{" "}
            {parent.name}.
          </p>
        ) : (
          <ul className="space-y-2">
            {subcategories.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryIconBadge
                    icon={sub.icon}
                    color={sub.color}
                    size="sm"
                  />
                  <span className="text-sm text-foreground truncate">
                    {sub.name}
                  </span>
                </div>
                <CategoryActionsMenu
                  item={{
                    id: sub.id,
                    name: sub.name,
                    icon: sub.icon,
                    color: sub.color,
                  }}
                  variant="subcategory"
                  onEdit={(item) => setEditTarget(item)}
                  onDelete={(item) => setDeleteTarget(item)}
                  onConvertToParent={(item) =>
                    openConversion(item, "to_parent")
                  }
                  triggerClassName="h-7 w-7"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {kind === "expense" ? (
        <CategoryBudgetSection
          categoryId={parent.id}
          categoryName={parent.name}
          subcategoryOptions={
            subcategories.map((sub) => ({
              id: sub.id,
              label: sub.name,
              value: sub.name,
              name: sub.name,
              parentId: parent.id,
            }))
          }
          spaceCurrency={currencyCode}
        />
      ) : null}

      <CategoryDetailTransactions
        categoryId={parent.id}
        categoryName={parent.name}
        categoryKind={kind}
        spaceCurrency={currencyCode}
        subcategories={subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
        }))}
      />

      {editTarget ? (
        <CategoryFormDialog
          category={editTarget}
          onUpdate={handleUpdate}
          isLoading={updateCategoryMutation.isPending}
          trigger={<span className="hidden" />}
          open={Boolean(editTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
            }
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteCategoryDialog
          category={deleteTarget}
          onDelete={handleDelete}
          isLoading={deleteCategoryMutation.isPending}
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          hideTrigger
        />
      ) : null}

      <CategoryFormDialog
        categoryType={categoryType}
        parentId={parent.id}
        parentName={parent.name}
        onAdd={handleCreate}
        isLoading={createCategoryMutation.isPending}
        open={addSubcategoryOpen}
        onOpenChange={setAddSubcategoryOpen}
        trigger={<span className="hidden" />}
      />

      {convertTarget && conversionType ? (
        <ConvertCategoryDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConvertTarget(null);
              setConversionType(null);
            }
          }}
          category={convertTarget}
          conversionType={conversionType}
          kind={kind}
          rootCategories={tree}
          currencyCode={currencyCode}
          onConverted={handleConverted}
        />
      ) : null}
    </div>
  );
};

export default CategoryDetailContent;
