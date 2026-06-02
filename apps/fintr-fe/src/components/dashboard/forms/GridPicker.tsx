"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Edit2, X, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import CategoryCreationForm from "./CategoryCreationForm";
import AccountCreationForm from "./AccountCreationForm";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import { ACCOUNT_EDIT_LOCK_DISABLED_HINT } from "@/utils/accountSelectEditLocks";
import { GridPickerModalShell } from "./GridPickerModalShell";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import {
  formatCategoryPickerValue,
  getCategoryDisplayLabel,
  getCategoryTriggerDisplay,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";
import { gridPickerSubcategoryCountLabel } from "@/utils/categoryManagement";
import { isCategoryTree } from "@/utils/categoryTreeOptions";

const GRID_ITEM_BASE =
  "flex min-h-[60px] items-center justify-center rounded-lg border-2 p-4 transition-all";

const GRID_ITEM_DEFAULT =
  "border-gray-200 font-medium text-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:border-0 dark:bg-muted dark:text-primary-dark-mode dark:hover:border-0 dark:hover:bg-accent";

const GRID_ITEM_SELECTED =
  "border-primary bg-primary font-semibold text-primary-foreground shadow-sm dark:border-0";

const GRID_ITEM_LOCKED =
  "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 opacity-60 dark:border-0 dark:bg-muted/50 dark:text-muted-foreground";

const GRID_ITEM_ADD =
  "flex min-h-[60px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-all hover:border-primary hover:bg-primary/5 dark:border-0 dark:bg-muted dark:text-primary-dark-mode dark:hover:border-0 dark:hover:bg-accent";

type GridPickerSharedProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
  disabled?: boolean;
  triggerId?: string;
  placeholder?: string;
  modalTitle?: string;
  emptyMessage?: string;
  "data-testid"?: string;
  allowInlineCreate?: boolean;
  /** When set, controls the picker sheet open state (e.g. standalone category step). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the trigger button; use with controlled `open` for flows that open the sheet elsewhere. */
  hideTrigger?: boolean;
  /** Omit the built-in label (e.g. when wrapped in FormControlField). */
  hideLabel?: boolean;
  /** Called after a value is chosen and the sheet closes. */
  onAfterSelect?: () => void;
};

export type GridPickerCategoryProps = GridPickerSharedProps & {
  pickerKind: "category";
  categories: CategoryTreeOption[] | Array<{ label: string; value: string }>;
  categoryType: CategoryTypeEnum;
  onCategoryCreated?: (value: string) => void;
};

export type GridPickerAccountProps = GridPickerSharedProps & {
  pickerKind: "account";
  accounts: AccountOptionWithCurrency[];
  onAccountCreated?: (accountName: string) => void;
  isOptionDisabled?: (option: AccountOptionWithCurrency) => boolean;
  disabledOptionTitle?: string;
};

export type GridPickerProps = GridPickerCategoryProps | GridPickerAccountProps;

const defaultTriggerId = (props: GridPickerProps): string => {
  if (props.triggerId) {
    return props.triggerId;
  }
  return props.pickerKind === "category" ? "category" : "account-picker";
};

const defaultPlaceholder = (props: GridPickerProps): string => {
  if (props.placeholder) {
    return props.placeholder;
  }
  return props.pickerKind === "category" ? "Select category" : "Select account";
};

const defaultModalTitle = (props: GridPickerProps): string => {
  if (props.modalTitle) {
    return props.modalTitle;
  }
  return props.pickerKind === "category" ? "Category" : "Account";
};

const defaultDataTestId = (props: GridPickerProps): string | undefined => {
  if (props["data-testid"] !== undefined) {
    return props["data-testid"];
  }
  return props.pickerKind === "category" ? "category-select" : undefined;
};

const GridPicker: React.FC<GridPickerProps> = (props) => {
  const isControlledOpen = props.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlledOpen ? Boolean(props.open) : internalOpen;
  const [showCreation, setShowCreation] = useState(false);
  const [pickerStep, setPickerStep] = useState<"parents" | "children">("parents");
  const [selectedParent, setSelectedParent] = useState<CategoryTreeOption | null>(
    null,
  );

  const allowInlineCreate = props.allowInlineCreate ?? true;
  const hideTrigger = props.hideTrigger ?? false;
  const hideLabel = props.hideLabel ?? false;
  const triggerId = defaultTriggerId(props);
  const placeholder = defaultPlaceholder(props);
  const modalTitle = defaultModalTitle(props);
  const dataTestId = defaultDataTestId(props);

  const categoryTree = useMemo(() => {
    if (props.pickerKind !== "category") {
      return [] as CategoryTreeOption[];
    }

    if (isCategoryTree(props.categories)) {
      return props.categories;
    }

    return props.categories.map((option) => ({
      id: option.value,
      label: option.label,
      value: option.value,
      name: option.label,
      parentId: null,
      children: [],
    }));
  }, [props]);

  const hierarchicalCategoryPicker =
    props.pickerKind === "category" && isCategoryTree(props.categories);

  const options =
    props.pickerKind === "category"
      ? categoryTree
      : props.accounts;

  const disabledOptionTitle =
    props.pickerKind === "account"
      ? (props.disabledOptionTitle ?? ACCOUNT_EDIT_LOCK_DISABLED_HINT)
      : undefined;

  const {
    label,
    value,
    error,
    disabled = false,
    onChange,
    emptyMessage,
  } = props;

  const setPickerOpen = useCallback(
    (nextOpen: boolean) => {
      props.onOpenChange?.(nextOpen);
      if (!isControlledOpen) {
        setInternalOpen(nextOpen);
      }
    },
    [isControlledOpen, props],
  );

  const closeModal = useCallback(() => {
    setPickerOpen(false);
    setShowCreation(false);
    setPickerStep("parents");
    setSelectedParent(null);
  }, [setPickerOpen]);

  const completeSelection = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeModal();
      props.onAfterSelect?.();
    },
    [onChange, closeModal, props],
  );

  const handleSelectParent = (parent: CategoryTreeOption, parentOnly: boolean) => {
    if (parentOnly || (parent.children?.length ?? 0) === 0) {
      completeSelection(
        formatCategoryPickerValue({
          categoryId: parent.id,
          subcategoryId: null,
        }),
      );
      return;
    }

    setSelectedParent(parent);
    setPickerStep("children");
  };

  const handleSelectChild = (parent: CategoryTreeOption, childId: string | null) => {
    completeSelection(
      formatCategoryPickerValue({
        categoryId: parent.id,
        subcategoryId: childId,
      }),
    );
  };

  const handleSelect = (itemValue: string) => {
    completeSelection(itemValue);
  };

  const handleCreated = (name: string, createdId?: string) => {
    if (props.pickerKind === "category") {
      const parent = selectedParent;
      const createdValue = createdId
        ? formatCategoryPickerValue({
            categoryId: parent?.id ?? createdId,
            subcategoryId: parent ? createdId : null,
          })
        : name;

      onChange(createdValue);
      if (props.onCategoryCreated) {
        props.onCategoryCreated(createdValue);
      }
      props.onAfterSelect?.();
    } else if (name) {
      onChange(name);
      if (props.onAccountCreated) {
        props.onAccountCreated(name);
      }
      props.onAfterSelect?.();
    }

    setShowCreation(false);
    closeModal();
  };

  const displayLabel = useMemo(() => {
    if (!value) {
      return "";
    }

    if (props.pickerKind === "category" && hierarchicalCategoryPicker) {
      return getCategoryDisplayLabel(value, categoryTree);
    }

    const selected = (options as Array<{ label: string; value: string }>).find(
      (item) => item.value === value,
    );
    return selected?.label ?? value;
  }, [value, props.pickerKind, hierarchicalCategoryPicker, categoryTree, options]);

  const categoryTriggerDisplay = useMemo(() => {
    if (
      !value ||
      props.pickerKind !== "category" ||
      !hierarchicalCategoryPicker
    ) {
      return null;
    }

    return getCategoryTriggerDisplay(value, categoryTree);
  }, [value, props.pickerKind, hierarchicalCategoryPicker, categoryTree]);

  const optionLocked = (option: { label: string; value: string }): boolean => {
    if (props.pickerKind !== "account" || !props.isOptionDisabled) {
      return false;
    }
    return props.isOptionDisabled(option as AccountOptionWithCurrency);
  };

  const openModal = () => {
    if (disabled) {
      return;
    }

    setPickerStep("parents");
    setSelectedParent(null);
    setPickerOpen(true);
  };

  const backLabel =
    props.pickerKind === "category" ? "Back to Categories" : "Back to Accounts";

  const renderCategoryGrid = () => {
    if (pickerStep === "children" && selectedParent) {
      const children = selectedParent.children ?? [];

      return (
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              setPickerStep("parents");
              setSelectedParent(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {selectedParent.label}
          </Button>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSelectChild(selectedParent, null)}
              className={cn(GRID_ITEM_BASE, GRID_ITEM_DEFAULT, "text-sm")}
            >
              Use parent only
            </button>
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => handleSelectChild(selectedParent, child.id)}
                className={cn(
                  GRID_ITEM_BASE,
                  value ===
                    formatCategoryPickerValue({
                      categoryId: selectedParent.id,
                      subcategoryId: child.id,
                    })
                    ? GRID_ITEM_SELECTED
                    : GRID_ITEM_DEFAULT,
                )}
              >
                <span className="text-center text-sm leading-tight">
                  {child.label}
                </span>
              </button>
            ))}
            {allowInlineCreate && (
              <button
                type="button"
                onClick={() => setShowCreation(true)}
                className={GRID_ITEM_ADD}
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Add New</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-3">
        {categoryTree.map((parent) => {
          const parentValue = formatCategoryPickerValue({
            categoryId: parent.id,
            subcategoryId: null,
          });
          const subcategoryLabel = gridPickerSubcategoryCountLabel(
            parent.children?.length ?? 0,
          );

          return (
            <button
              key={parent.id}
              type="button"
              onClick={() => handleSelectParent(parent, false)}
              className={cn(
                GRID_ITEM_BASE,
                "flex-col gap-1",
                value === parentValue ||
                  parseCategoryPickerValue(value)?.categoryId === parent.id
                  ? GRID_ITEM_SELECTED
                  : GRID_ITEM_DEFAULT,
              )}
            >
              <span className="text-center text-sm leading-tight">
                {parent.label}
              </span>
              {subcategoryLabel ? (
                <span className="text-xs opacity-80">{subcategoryLabel}</span>
              ) : null}
            </button>
          );
        })}
        {allowInlineCreate && (
          <button
            type="button"
            onClick={() => setShowCreation(true)}
            className={GRID_ITEM_ADD}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Add New</span>
          </button>
        )}
      </div>
    );
  };

  const modalShell = (
      <GridPickerModalShell open={isOpen} onRequestClose={closeModal}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-primary">
            {pickerStep === "children" && selectedParent
              ? selectedParent.label
              : modalTitle}
          </h3>
          <div className="flex gap-2">
            {allowInlineCreate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreation(true)}
                className="h-8 w-8 p-0"
                aria-label={
                  props.pickerKind === "category"
                    ? "Add new category"
                    : "Add new account"
                }
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeModal}
              className="h-8 w-8 p-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {showCreation && allowInlineCreate ? (
            <div className="space-y-4">
              {props.pickerKind === "category" ? (
                <CategoryCreationForm
                  onSuccess={handleCreated}
                  categoryType={props.categoryType}
                  parentId={selectedParent?.id}
                />
              ) : (
                <AccountCreationForm onSuccess={handleCreated} />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreation(false)}
                className="w-full"
              >
                {backLabel}
              </Button>
            </div>
          ) : props.pickerKind === "category" && hierarchicalCategoryPicker ? (
            renderCategoryGrid()
          ) : options.length === 0 ? (
            <div className="space-y-4">
              {emptyMessage && (
                <p className="text-sm text-muted-foreground text-center px-2">
                  {emptyMessage}
                </p>
              )}
              {allowInlineCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreation(true)}
                  className={cn(GRID_ITEM_ADD, "w-full")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {(options as Array<{ label: string; value: string }>).map(
                (option) => {
                  const locked = optionLocked(option);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={locked}
                      title={locked ? disabledOptionTitle : undefined}
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        GRID_ITEM_BASE,
                        locked
                          ? GRID_ITEM_LOCKED
                          : value === option.value
                            ? GRID_ITEM_SELECTED
                            : GRID_ITEM_DEFAULT,
                      )}
                    >
                      <span className="text-center text-sm leading-tight">
                        {option.label}
                      </span>
                    </button>
                  );
                },
              )}
              {allowInlineCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreation(true)}
                  className={GRID_ITEM_ADD}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New</span>
                </button>
              )}
            </div>
          )}
        </div>
      </GridPickerModalShell>
  );

  if (hideTrigger) {
    return modalShell;
  }

  return (
    <div className={cn("min-w-0", hideLabel ? "h-full w-full" : "space-y-2")}>
      {!hideLabel ? (
        <Label htmlFor={triggerId} className="text-sm">
          {label}
        </Label>
      ) : null}

      <Button
        id={triggerId}
        type="button"
        variant="ghost"
        onClick={openModal}
        disabled={disabled}
        title={value ? displayLabel : undefined}
        data-testid={dataTestId}
        className={cn(
          "w-full min-w-0 justify-start gap-0 overflow-hidden text-left font-normal",
          formControlInteractiveSurfaceClassName,
          hideLabel && "h-full",
          categoryTriggerDisplay?.secondary
            ? "h-auto min-h-[52px]"
            : "",
          !value && "text-muted-foreground",
          error && error.length > 0 && "ring-1 ring-red-800 focus-visible:ring-red-800",
        )}
      >
        {value ? (
          categoryTriggerDisplay?.secondary ? (
            <span className="min-w-0 flex flex-1 flex-col gap-0.5 text-left">
              <span className="truncate text-sm font-medium leading-tight">
                {categoryTriggerDisplay.primary}
              </span>
              <span className="truncate text-xs leading-tight text-muted-foreground">
                {categoryTriggerDisplay.secondary}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 overflow-hidden text-clip whitespace-nowrap text-left font-medium">
              {displayLabel}
            </span>
          )
        ) : (
          <span className="min-w-0 flex-1 overflow-hidden text-clip whitespace-nowrap text-left">
            {placeholder}
          </span>
        )}
      </Button>

      {error && error.length > 0 && (
        <p className="text-sm text-red-600">{error[0]}</p>
      )}

      {modalShell}
    </div>
  );
};

export default GridPicker;
