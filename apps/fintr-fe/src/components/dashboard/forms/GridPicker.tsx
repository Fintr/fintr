"use client";

import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Edit2, X, Plus, ArrowLeft, GripVertical, ChevronRight } from "lucide-react";
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

type CategoryOption = { label: string; value: string };

const LONG_PRESS_MS = 500;

const getCategoryStorageKey = (categoryType: CategoryTypeEnum) =>
  `fintr-category-order-${categoryType}`;

const getCategorySubStorageKey = (categoryType: CategoryTypeEnum, parentId: string) =>
  `fintr-subcategory-order-${categoryType}-${parentId}`;

const sortByStoredOrder = <T extends { value: string }>(items: T[], savedOrder: string[]): T[] =>
  [...items].sort((a, b) => {
    const ai = savedOrder.indexOf(a.value);
    const bi = savedOrder.indexOf(b.value);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

const loadOrderedCategories = (
  categories: CategoryTreeOption[],
  categoryType: CategoryTypeEnum,
): CategoryTreeOption[] => {
  if (typeof window === "undefined") return [...categories];
  let sorted: CategoryTreeOption[];
  try {
    const saved = localStorage.getItem(getCategoryStorageKey(categoryType));
    sorted = saved ? sortByStoredOrder(categories, JSON.parse(saved)) : [...categories];
  } catch {
    sorted = [...categories];
  }
  return sorted.map((cat) => {
    if (!cat.children?.length) return cat;
    try {
      const savedChildren = localStorage.getItem(getCategorySubStorageKey(categoryType, cat.id));
      if (savedChildren) {
        return { ...cat, children: sortByStoredOrder(cat.children, JSON.parse(savedChildren)) };
      }
    } catch {}
    return cat;
  });
};

const DraggableCategoryItem: React.FC<{
  option: CategoryOption;
  isSelected: boolean;
  childCount?: number;
  onDrillIn?: () => void;
}> = ({ option, isSelected, childCount, onDrillIn }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={controls}
      className={cn(
        "flex list-none items-center justify-between rounded-lg border-2 bg-white px-4 py-3 select-none",
        isSelected
          ? "border-primary bg-primary/5 font-semibold text-primary"
          : "border-gray-200 text-gray-700",
      )}
    >
      <span className="flex-1 text-sm font-medium leading-tight">
        {option.label}
        {childCount ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {childCount} sub
          </span>
        ) : null}
      </span>
      <div className="flex items-center gap-1">
        {onDrillIn && (
          <button
            type="button"
            onClick={onDrillIn}
            className="flex items-center gap-0.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-gray-100 hover:text-foreground"
          >
            Subs <ChevronRight className="h-3 w-3" />
          </button>
        )}
        <div
          className="ml-1 flex-shrink-0 touch-none cursor-grab p-1 text-gray-400 active:cursor-grabbing"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      </div>
    </Reorder.Item>
  );
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
  const [isArranging, setIsArranging] = useState(false);
  const [arrangingParent, setArrangingParent] = useState<CategoryTreeOption | null>(null);


  const allowInlineCreate = props.allowInlineCreate ?? true;
  const hideTrigger = props.hideTrigger ?? false;
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

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
    setIsArranging(false);
    setArrangingParent(null);
    cancelLongPress();
  }, [setPickerOpen, cancelLongPress]);

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

  const [orderedCategories, setOrderedCategories] = useState<CategoryTreeOption[]>(
    () =>
      props.pickerKind === "category"
        ? loadOrderedCategories(categoryTree, props.categoryType)
        : [],
  );

  const categoryValuesKey = categoryTree.map((o) => o.value).join(",");

  useEffect(() => {
    if (props.pickerKind !== "category") return;
    setOrderedCategories((prev) => {
      const updated = prev
        .filter((p) => categoryTree.some((c) => c.value === p.value))
        .map((p) => categoryTree.find((c) => c.value === p.value)!);
      const newOnes = categoryTree.filter(
        (c) => !prev.some((p) => p.value === c.value),
      );
      return [...updated, ...newOnes];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryValuesKey, props.pickerKind]);

  const handleSubReorder = useCallback(
    (parentId: string, newChildOrder: CategoryTreeOption[]) => {
      setOrderedCategories((prev) =>
        prev.map((cat) =>
          cat.id === parentId ? { ...cat, children: newChildOrder } : cat,
        ),
      );
      if (props.pickerKind === "category") {
        try {
          localStorage.setItem(
            getCategorySubStorageKey(props.categoryType, parentId),
            JSON.stringify(newChildOrder.map((c) => c.value)),
          );
        } catch {}
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.pickerKind === "category" ? props.categoryType : null],
  );

  const handleReorder = useCallback(
    (newOrder: CategoryTreeOption[]) => {
      setOrderedCategories(newOrder);
      if (props.pickerKind === "category") {
        try {
          localStorage.setItem(
            getCategoryStorageKey(props.categoryType),
            JSON.stringify(newOrder.map((o) => o.value)),
          );
        } catch {}
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.pickerKind === "category" ? props.categoryType : null],
  );

  const startLongPress = useCallback(() => {
    if (props.pickerKind !== "category") return;
    longPressTimer.current = setTimeout(() => {
      setIsArranging(true);
    }, LONG_PRESS_MS);
  }, [props.pickerKind]);

  const handleSelect = (itemValue: string) => {
    if (isArranging) return;
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

  const displayOptions =
    props.pickerKind === "category" ? orderedCategories : options;

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
        {orderedCategories.map((parent) => {
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
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => {
                e.preventDefault();
                cancelLongPress();
                setIsArranging(true);
              }}
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
            {isArranging
              ? arrangingParent
                ? `Arrange ${arrangingParent.label}`
                : `Arrange ${modalTitle}`
              : pickerStep === "children" && selectedParent
                ? selectedParent.label
                : modalTitle}
          </h3>
          <div className="flex gap-2">
            {isArranging ? (
              arrangingParent ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setArrangingParent(null)}
                  className="h-8 px-3 text-sm font-semibold text-primary"
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsArranging(false); setArrangingParent(null); }}
                  className="h-8 px-3 text-sm font-semibold text-primary"
                >
                  Done
                </Button>
              )
            ) : (
              <>
                {props.pickerKind === "category" &&
                  orderedCategories.length > 0 &&
                  !showCreation &&
                  pickerStep === "parents" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsArranging(true)}
                      className="h-8 w-8 p-0"
                      aria-label="Arrange categories"
                      title="Arrange categories"
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  )}
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
              </>
            )}
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
          ) : isArranging && props.pickerKind === "category" ? (
            <div>
              <p className="mb-3 text-xs text-muted-foreground">
                Hold the grip handle and drag to rearrange.
              </p>
              {arrangingParent ? (
                <Reorder.Group
                  axis="y"
                  values={arrangingParent.children ?? []}
                  onReorder={(newOrder: CategoryTreeOption[]) => {
                    const updated = { ...arrangingParent, children: newOrder };
                    setArrangingParent(updated);
                    handleSubReorder(arrangingParent.id, newOrder);
                  }}
                  className="m-0 list-none space-y-2 p-0"
                >
                  {(arrangingParent.children ?? []).map((child) => (
                    <DraggableCategoryItem
                      key={child.value}
                      option={child}
                      isSelected={
                        parseCategoryPickerValue(value)?.subcategoryId === child.id
                      }
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={orderedCategories}
                  onReorder={handleReorder}
                  className="m-0 list-none space-y-2 p-0"
                >
                  {orderedCategories.map((option) => (
                    <DraggableCategoryItem
                      key={option.value}
                      option={option}
                      isSelected={
                        value === option.value ||
                        parseCategoryPickerValue(value)?.categoryId === option.id
                      }
                      childCount={option.children?.length}
                      onDrillIn={
                        (option.children?.length ?? 0) > 0
                          ? () => setArrangingParent(
                              orderedCategories.find((c) => c.id === option.id) ?? option
                            )
                          : undefined
                      }
                    />
                  ))}
                </Reorder.Group>
              )}
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
              {(displayOptions as Array<{ label: string; value: string }>).map(
                (option) => {
                  const locked = optionLocked(option);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={locked}
                      title={locked ? disabledOptionTitle : undefined}
                      onClick={() => handleSelect(option.value)}
                      onPointerDown={startLongPress}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onContextMenu={(e) => {
                        if (props.pickerKind === "category") {
                          e.preventDefault();
                          cancelLongPress();
                          setIsArranging(true);
                        }
                      }}
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
    <div className="space-y-2 min-w-0">
      <Label htmlFor={triggerId} className="text-sm">
        {label}
      </Label>

      <Button
        id={triggerId}
        type="button"
        variant="ghost"
        onClick={openModal}
        disabled={disabled}
        title={value ? displayLabel : undefined}
        data-testid={dataTestId}
        className={cn(
          "h-auto w-full min-w-0 justify-start gap-0 overflow-hidden bg-input/30 px-3 py-2 text-left text-sm font-normal hover:bg-input/50",
          categoryTriggerDisplay?.secondary ? "min-h-[52px]" : "min-h-10",
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
