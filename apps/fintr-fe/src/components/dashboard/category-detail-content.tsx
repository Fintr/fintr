"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { navigateDashboardClient } from "@/utils/detailSearchParam";
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
  findCategoryInTree,
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
import { CategorySubcategoryChips } from "@/components/dashboard/category-subcategory-chips";
import { CategoryManageSubcategoriesSheet } from "@/components/dashboard/category-manage-subcategories-sheet";

type CategoryDetailContentProps = {
  categoryId: string;
  kind: CategoryKind;
};

const CategoryDetailContent: React.FC<CategoryDetailContentProps> = ({
  categoryId,
  kind,
}) => {
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
    convertCategoryMutation,
  } = useTransactionCategories();

  const tree = kind === "income" ? incomeCategories : expenseCategories;
  const parent = useMemo(
    () => findCategoryInTree(tree, categoryId)?.root ?? null,
    [tree, categoryId],
  );

  const [editTarget, setEditTarget] = useState<CategoryMenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryMenuItem | null>(
    null,
  );
  const [addSubcategoryOpen, setAddSubcategoryOpen] = useState(false);
  const [manageSubcategoriesOpen, setManageSubcategoriesOpen] = useState(false);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<
    string | null
  >(null);
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
  };

  const handleDelete = async (id: string) => {
    const response = await deleteCategoryMutation.mutateAsync(id);
    const deletedParentCategory = id === parent?.id;

    if (deletedParentCategory) {
      navigateDashboardClient("/dashboard/space_settings/categories");
      return response;
    }

    if (selectedSubcategoryId === id) {
      setSelectedSubcategoryId(null);
    }

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
    navigateDashboardClient(buildCategoryDetailHref(redirectParentId, kind));
  };

  const handleConfirmConvert = async (input: {
    conversionType: CategoryConversionType;
    newParentId: string | null;
  }) => {
    const result = await convertCategoryMutation.mutateAsync({
      categoryId: convertTarget?.id ?? categoryId,
      conversionType: input.conversionType,
      newParentId: input.newParentId,
    });

    return { redirectParentId: result.redirectParentId };
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

  const visibleSubcategoryId =
    selectedSubcategoryId
    && subcategories.some((sub) => sub.id === selectedSubcategoryId)
      ? selectedSubcategoryId
      : null;

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
          onManageSubcategories={
            subcategories.length > 0
              ? () => setManageSubcategoriesOpen(true)
              : undefined
          }
          onConvertToSubcategory={(item) =>
            openConversion(item, "to_subcategory")
          }
        />
      </div>

      <CategorySubcategoryChips
        subcategories={subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
        }))}
        selectedSubcategoryId={visibleSubcategoryId}
        onSelect={setSelectedSubcategoryId}
      />

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
        selectedSubcategoryId={visibleSubcategoryId}
        subcategories={subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
        }))}
      />

      <CategoryManageSubcategoriesSheet
        open={manageSubcategoriesOpen}
        onOpenChange={setManageSubcategoriesOpen}
        parentName={parent.name}
        subcategories={subcategories}
        onEdit={(item) => {
          setManageSubcategoriesOpen(false);
          setEditTarget(item);
        }}
        onDelete={(item) => {
          setManageSubcategoriesOpen(false);
          setDeleteTarget(item);
        }}
        onConvertToParent={(item) => {
          setManageSubcategoriesOpen(false);
          openConversion(item, "to_parent");
        }}
      />

      <CategoryFormDialog
        category={editTarget ?? undefined}
        onUpdate={handleUpdate}
        isLoading={updateCategoryMutation.isPending}
        trigger={<span className="hidden" />}
        hideTrigger
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
      />

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
          onConfirmConvert={handleConfirmConvert}
        />
      ) : null}
    </div>
  );
};

export default CategoryDetailContent;
