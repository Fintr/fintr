"use client";

import React, { useCallback, useState } from "react";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Edit2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import CategoryCreationForm from "./CategoryCreationForm";
import AccountCreationForm from "./AccountCreationForm";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import { ACCOUNT_EDIT_LOCK_DISABLED_HINT } from "@/utils/accountSelectEditLocks";
import { GridPickerModalShell } from "./GridPickerModalShell";

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
};

export type GridPickerCategoryProps = GridPickerSharedProps & {
  pickerKind: "category";
  categories: Array<{ label: string; value: string }>;
  categoryType: CategoryTypeEnum;
  onCategoryCreated?: (categoryName: string) => void;
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
  const [isOpen, setIsOpen] = useState(false);
  const [showCreation, setShowCreation] = useState(false);

  const options =
    props.pickerKind === "category" ? props.categories : props.accounts;

  const allowInlineCreate = props.allowInlineCreate ?? true;

  const triggerId = defaultTriggerId(props);
  const placeholder = defaultPlaceholder(props);
  const modalTitle = defaultModalTitle(props);
  const dataTestId = defaultDataTestId(props);

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

  const handleSelect = (itemValue: string) => {
    onChange(itemValue);
    setIsOpen(false);
  };

  const handleCreated = (name: string) => {
    if (name) {
      onChange(name);
      if (props.pickerKind === "category" && props.onCategoryCreated) {
        props.onCategoryCreated(name);
      }
      if (props.pickerKind === "account" && props.onAccountCreated) {
        props.onAccountCreated(name);
      }
    }
    setShowCreation(false);
    setIsOpen(false);
  };

  const selected = options.find((item) => item.value === value);
  const displayLabel =
    value && selected ? selected.label : value ? value : "";

  const optionLocked = (option: { label: string; value: string }): boolean => {
    if (props.pickerKind !== "account" || !props.isOptionDisabled) {
      return false;
    }
    return props.isOptionDisabled(option as AccountOptionWithCurrency);
  };

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setShowCreation(false);
  }, []);

  const backLabel =
    props.pickerKind === "category" ? "Back to Categories" : "Back to Accounts";

  return (
    <div className="space-y-2 min-w-0">
      <Label htmlFor={triggerId} className="text-sm">
        {label}
      </Label>

      <Button
        id={triggerId}
        type="button"
        variant="outline"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        title={value ? displayLabel : undefined}
        data-testid={dataTestId}
        className={cn(
          "h-10 w-full min-w-0 justify-start gap-0 overflow-hidden px-3 text-left text-sm font-normal",
          !value && "text-muted-foreground",
          error && error.length > 0 && "border-red-800 focus-visible:ring-red-800",
        )}
      >
        {value ? (
          <span className="min-w-0 flex-1 overflow-hidden text-clip whitespace-nowrap text-left font-medium">
            {displayLabel}
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

      <GridPickerModalShell open={isOpen} onRequestClose={closeModal}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-primary">{modalTitle}</h3>
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
                  className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-all hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {options.map((option) => {
                const locked = optionLocked(option);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={locked}
                    title={locked ? disabledOptionTitle : undefined}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex min-h-[60px] items-center justify-center rounded-lg border-2 p-4 transition-all",
                      locked
                        ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 opacity-60"
                        : value === option.value
                          ? "border-primary bg-primary font-semibold text-primary-foreground shadow-sm"
                          : "border-gray-200 font-medium text-gray-700 hover:border-primary/50 hover:bg-gray-50",
                    )}
                  >
                    <span className="text-center text-sm leading-tight">
                      {option.label}
                    </span>
                  </button>
                );
              })}
              {allowInlineCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreation(true)}
                  className="flex min-h-[60px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 transition-all hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New</span>
                </button>
              )}
            </div>
          )}
        </div>
      </GridPickerModalShell>
    </div>
  );
};

export default GridPicker;
