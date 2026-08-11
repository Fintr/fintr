"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Edit2, X, Plus, ArrowLeft, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import CategoryCreationForm from "./CategoryCreationForm";
import AccountCreationForm from "./AccountCreationForm";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import { ACCOUNT_EDIT_LOCK_DISABLED_HINT } from "@/utils/accountSelectEditLocks";
import { GridPickerModalShell } from "./GridPickerModalShell";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import {
  formatCategoryPickerValue,
  getCategoryAppearanceForPickerValue,
  getCategoryDisplayLabel,
  getCategoryTriggerDisplay,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";
import { gridPickerSubcategoryCountLabel } from "@/utils/categoryManagement";
import { isCategoryTree } from "@/utils/categoryTreeOptions";
import { CategoryIconBadge } from "@/components/dashboard/category-icon-badge";
import { AccountIconBadge } from "@/components/dashboard/account-icon-badge";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "@/hooks/useDebouncedValue";

const GRID_ITEM_BASE =
  "flex min-h-[60px] items-center justify-center rounded-lg border-2 p-4 transition-all";

const GRID_ITEM_DEFAULT =
  "border-gray-200 font-medium text-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:border-0 dark:bg-muted dark:text-primary-dark-mode dark:hover:border-0 dark:hover:bg-accent";

const GRID_ITEM_SELECTED =
  "border-primary bg-primary/10 font-semibold text-primary shadow-sm dark:border-primary/30 dark:bg-primary/15 dark:text-primary-dark-mode";

const GRID_ITEM_LOCKED =
  "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 opacity-60 dark:border-0 dark:bg-muted/50 dark:text-muted-foreground";

const GRID_ITEM_ADD =
  "flex min-h-[60px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-all hover:border-primary hover:bg-primary/5 dark:border-0 dark:bg-muted dark:text-primary-dark-mode dark:hover:border-0 dark:hover:bg-accent";

const ACCOUNT_GRID_ITEM_BASE =
  "flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 transition-all";

const accountBalanceColorClass = (amount: number): string => {
  if (amount < 0) {
    return "text-red-900 dark:text-red-700";
  }
  if (amount > 0) {
    return "text-teal-600 dark:text-teal-500";
  }
  return "text-muted-foreground";
};

const formatAccountBalance = (
  balance: string | number | undefined,
  currency?: string,
): string | null => {
  if (balance === undefined || balance === null || balance === "") {
    return null;
  }

  const amount = Number(balance);
  if (Number.isNaN(amount)) {
    return null;
  }

  return formatCurrency(amount, currency ?? "PHP");
};

const normalizeCurrencyCode = (currency?: string): string | null => {
  if (!currency?.trim()) {
    return null;
  }

  return currency.trim().toUpperCase();
};

const isNonSpaceAccountCurrency = (
  accountCurrency: string | undefined,
  spaceCurrency: string,
): boolean => {
  const normalizedAccountCurrency = normalizeCurrencyCode(accountCurrency);
  const normalizedSpaceCurrency = normalizeCurrencyCode(spaceCurrency) ?? "PHP";

  if (!normalizedAccountCurrency) {
    return false;
  }

  return normalizedAccountCurrency !== normalizedSpaceCurrency;
};

const AccountCurrencyPill: React.FC<{ currency: string }> = ({ currency }) => (
  <span
    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/60 bg-muted/70 text-[7px] font-bold uppercase leading-none tracking-tighter text-muted-foreground"
    aria-label={`Currency ${currency}`}
  >
    {currency.slice(0, 3)}
  </span>
);

type PickerSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  testId: string;
};

const PickerSearchInput: React.FC<PickerSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  testId,
}) => (
  <div className="relative shrink-0">
    <Search
      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="pl-9"
      data-testid={testId}
    />
  </div>
);

const PickerScrollShell: React.FC<{
  search: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ search, footer, children }) => (
  <div className="flex min-h-0 flex-1 flex-col gap-3">
    {search}
    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    {footer}
  </div>
);

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
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const debouncedAccountSearchQuery = useDebouncedValue(
    accountSearchQuery,
    SEARCH_DEBOUNCE_MS,
  );
  const debouncedCategorySearchQuery = useDebouncedValue(
    categorySearchQuery,
    SEARCH_DEBOUNCE_MS,
  );
  const currentSpace = useAtomValue(currentSpaceAtom);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

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
    setAccountSearchQuery("");
    setCategorySearchQuery("");
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

  const categoryTriggerAppearance = useMemo(() => {
    if (!value || props.pickerKind !== "category") {
      return null;
    }

    return getCategoryAppearanceForPickerValue(value, categoryTree);
  }, [value, props.pickerKind, categoryTree]);

  const selectedAccountOption = useMemo(() => {
    if (props.pickerKind !== "account" || !value) {
      return null;
    }

    return props.accounts.find((account) => account.value === value) ?? null;
  }, [props, value]);

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

  const filteredAccounts = useMemo(() => {
    if (props.pickerKind !== "account") {
      return [];
    }

    const query = debouncedAccountSearchQuery.trim().toLowerCase();
    if (!query) {
      return props.accounts;
    }

    return props.accounts.filter((account) =>
      account.label.toLowerCase().includes(query),
    );
  }, [props, debouncedAccountSearchQuery]);

  const filteredCategoryParents = useMemo(() => {
    if (props.pickerKind !== "category") {
      return [];
    }

    const query = debouncedCategorySearchQuery.trim().toLowerCase();
    if (!query) {
      return categoryTree;
    }

    return categoryTree.filter((parent) =>
      parent.label.toLowerCase().includes(query),
    );
  }, [props.pickerKind, categoryTree, debouncedCategorySearchQuery]);

  const filteredCategoryChildren = useMemo(() => {
    if (!selectedParent) {
      return [];
    }

    const children = selectedParent.children ?? [];
    const query = debouncedCategorySearchQuery.trim().toLowerCase();
    if (!query) {
      return children;
    }

    return children.filter((child) =>
      child.label.toLowerCase().includes(query),
    );
  }, [selectedParent, debouncedCategorySearchQuery]);

  const filteredFlatCategories = useMemo(() => {
    if (props.pickerKind !== "category" || hierarchicalCategoryPicker) {
      return [];
    }

    const flatOptions = options as Array<{ label: string; value: string }>;
    const query = debouncedCategorySearchQuery.trim().toLowerCase();
    if (!query) {
      return flatOptions;
    }

    return flatOptions.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [
    props.pickerKind,
    hierarchicalCategoryPicker,
    options,
    debouncedCategorySearchQuery,
  ]);

  const usesFixedPickerLayout =
    !showCreation &&
    (props.pickerKind === "account" || props.pickerKind === "category");

  const renderAddNewButton = (fullWidth = false) => {
    if (!allowInlineCreate) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => setShowCreation(true)}
        className={cn(GRID_ITEM_ADD, "shrink-0", fullWidth && "w-full")}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">Add New</span>
      </button>
    );
  };

  const renderAccountGrid = () => {
    if (props.pickerKind !== "account") {
      return null;
    }

    return (
      <PickerScrollShell
        search={
          <PickerSearchInput
            value={accountSearchQuery}
            onChange={setAccountSearchQuery}
            placeholder="Search accounts…"
            ariaLabel="Search accounts"
            testId="account-picker-search"
          />
        }
        footer={renderAddNewButton(true)}
      >
        {filteredAccounts.length === 0 ? (
          <p className="px-2 text-center text-sm text-muted-foreground">
            {accountSearchQuery.trim()
              ? "No accounts match your search."
              : (emptyMessage ?? "No accounts available.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 content-start gap-3">
            {filteredAccounts.map((option) => {
              const locked = optionLocked(option);
              const balanceAmount = Number(option.balance ?? 0);
              const formattedBalance = formatAccountBalance(
                option.balance,
                option.currency,
              );
              const showCurrencyPill = isNonSpaceAccountCurrency(
                option.currency,
                spaceCurrency,
              );

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={locked}
                  title={locked ? disabledOptionTitle : undefined}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    ACCOUNT_GRID_ITEM_BASE,
                    locked
                      ? GRID_ITEM_LOCKED
                      : value === option.value
                        ? GRID_ITEM_SELECTED
                        : GRID_ITEM_DEFAULT,
                  )}
                >
                  <AccountIconBadge
                    accountCategory={option.accountCategory}
                    size="sm"
                  />
                  <div className="flex w-full items-center justify-center gap-1.5 text-center">
                    <span className="line-clamp-2 text-sm leading-tight">
                      {option.label}
                    </span>
                    {showCurrencyPill && option.currency ? (
                      <AccountCurrencyPill currency={option.currency} />
                    ) : null}
                  </div>
                  {formattedBalance ? (
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        accountBalanceColorClass(balanceAmount),
                      )}
                    >
                      {formattedBalance}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </PickerScrollShell>
    );
  };

  const renderFlatCategoryGrid = () => {
    if (props.pickerKind !== "category" || hierarchicalCategoryPicker) {
      return null;
    }

    return (
      <PickerScrollShell
        search={
          <PickerSearchInput
            value={categorySearchQuery}
            onChange={setCategorySearchQuery}
            placeholder="Search categories…"
            ariaLabel="Search categories"
            testId="category-picker-search"
          />
        }
        footer={renderAddNewButton(true)}
      >
        {filteredFlatCategories.length === 0 ? (
          <p className="px-2 text-center text-sm text-muted-foreground">
            {categorySearchQuery.trim()
              ? "No categories match your search."
              : (emptyMessage ?? "No categories available.")}
          </p>
        ) : (
          <div className="grid grid-cols-3 content-start gap-3">
            {filteredFlatCategories.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  GRID_ITEM_BASE,
                  "flex-col gap-2",
                  value === option.value ? GRID_ITEM_SELECTED : GRID_ITEM_DEFAULT,
                )}
              >
                <span className="text-center text-sm leading-tight">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </PickerScrollShell>
    );
  };

  const renderCategoryGrid = () => {
    if (pickerStep === "children" && selectedParent) {
      const hasChildResults =
        filteredCategoryChildren.length > 0 || !categorySearchQuery.trim();

      return (
        <PickerScrollShell
          search={
            <div className="flex shrink-0 flex-col gap-3">
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
              <PickerSearchInput
                value={categorySearchQuery}
                onChange={setCategorySearchQuery}
                placeholder="Search subcategories…"
                ariaLabel="Search subcategories"
                testId="category-picker-search"
              />
            </div>
          }
          footer={renderAddNewButton(true)}
        >
          {!hasChildResults ? (
            <p className="px-2 text-center text-sm text-muted-foreground">
              No subcategories match your search.
            </p>
          ) : (
            <div className="grid grid-cols-3 content-start gap-3">
              {!categorySearchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => handleSelectChild(selectedParent, null)}
                  className={cn(GRID_ITEM_BASE, GRID_ITEM_DEFAULT, "text-sm")}
                >
                  Use parent only
                </button>
              ) : null}
              {filteredCategoryChildren.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => handleSelectChild(selectedParent, child.id)}
                  className={cn(
                    GRID_ITEM_BASE,
                    "flex-col gap-2",
                    value ===
                      formatCategoryPickerValue({
                        categoryId: selectedParent.id,
                        subcategoryId: child.id,
                      })
                      ? GRID_ITEM_SELECTED
                      : GRID_ITEM_DEFAULT,
                  )}
                >
                  <CategoryIconBadge
                    icon={child.icon}
                    color={child.color}
                    size="sm"
                  />
                  <span className="text-center text-sm leading-tight">
                    {child.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </PickerScrollShell>
      );
    }

    return (
      <PickerScrollShell
        search={
          <PickerSearchInput
            value={categorySearchQuery}
            onChange={setCategorySearchQuery}
            placeholder="Search categories…"
            ariaLabel="Search categories"
            testId="category-picker-search"
          />
        }
        footer={renderAddNewButton(true)}
      >
        {filteredCategoryParents.length === 0 ? (
          <p className="px-2 text-center text-sm text-muted-foreground">
            {categorySearchQuery.trim()
              ? "No categories match your search."
              : (emptyMessage ?? "No categories available.")}
          </p>
        ) : (
          <div className="grid grid-cols-3 content-start gap-3">
            {filteredCategoryParents.map((parent) => {
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
                    "flex-col gap-2",
                    value === parentValue ||
                      parseCategoryPickerValue(value)?.categoryId === parent.id
                      ? GRID_ITEM_SELECTED
                      : GRID_ITEM_DEFAULT,
                  )}
                >
                  <CategoryIconBadge
                    icon={parent.icon}
                    color={parent.color}
                    size="sm"
                  />
                  <span className="text-center text-sm leading-tight">
                    {parent.label}
                  </span>
                  {subcategoryLabel ? (
                    <span className="text-xs opacity-80">{subcategoryLabel}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </PickerScrollShell>
    );
  };

  const modalShell = (
      <GridPickerModalShell
        open={isOpen}
        onRequestClose={closeModal}
        panelHeightClassName={
          props.pickerKind === "account" || props.pickerKind === "category"
            ? "h-[80vh] max-h-[80vh]"
            : undefined
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
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

        <div
          className={cn(
            "min-h-0 flex-1",
            usesFixedPickerLayout
              ? "flex flex-col p-4 pt-3"
              : "overflow-y-auto p-4",
          )}
        >
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
          ) : props.pickerKind === "account" ? (
            renderAccountGrid()
          ) : props.pickerKind === "category" ? (
            renderFlatCategoryGrid()
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
          ) : null}
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
          "w-full min-w-0 justify-start gap-2 overflow-hidden text-left font-normal",
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
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {props.pickerKind === "category" && categoryTriggerAppearance ? (
              <CategoryIconBadge
                icon={categoryTriggerAppearance.icon}
                color={categoryTriggerAppearance.color}
                size="sm"
              />
            ) : null}
            {props.pickerKind === "account" ? (
              <AccountIconBadge
                accountCategory={selectedAccountOption?.accountCategory}
                size="sm"
              />
            ) : null}
            {categoryTriggerDisplay?.secondary ? (
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
            )}
          </span>
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
