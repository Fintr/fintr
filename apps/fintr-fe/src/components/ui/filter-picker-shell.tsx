"use client";

import * as Ariakit from "@ariakit/react";
import { ChevronDown, X } from "lucide-react";
import { createContext, useContext, useRef } from "react";

import { comboboxInputClassName } from "@/components/ui/combobox";
import { formControlSurfaceClassName } from "@/components/ui/form-control-surface";
import { cn } from "@/lib/utils";

export const filterPickerPopoverClassName = cn(
  "pointer-events-auto z-[200] flex max-h-60 min-w-[8rem] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md p-0",
);

const filterPickerListClassName = cn(
  "min-h-0 flex-1 overflow-y-auto overscroll-contain py-1",
);

const FilterPickerStoreContext = createContext<Ariakit.ComboboxStore | null>(
  null,
);

export const FilterPickerItem = (
  props: Ariakit.ComboboxItemProps,
) => {
  const store = useContext(FilterPickerStoreContext);

  return <Ariakit.ComboboxItem store={store ?? undefined} {...props} />;
};

export type FilterPickerShellProps = {
  placeholder: string;
  searchPlaceholder: string;
  triggerLabel?: string;
  hasValue?: boolean;
  onClear?: () => void;
  clearAriaLabel?: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  children: (state: { searchValue: string; open: boolean }) => React.ReactNode;
};

export const FilterPickerShell = ({
  placeholder,
  searchPlaceholder,
  triggerLabel,
  hasValue = false,
  onClear,
  clearAriaLabel = "Clear",
  disabled = false,
  className,
  popoverClassName,
  children,
}: FilterPickerShellProps) => {
  const store = Ariakit.useComboboxStore({
    defaultValue: "",
    resetValueOnHide: true,
    includesBaseElement: false,
  });
  const open = store.useState("open");
  const searchValue = store.useState("value");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const displayLabel = hasValue && triggerLabel ? triggerLabel : placeholder;

  return (
    <FilterPickerStoreContext.Provider value={store}>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={displayLabel}
          className={cn(
            comboboxInputClassName,
            "relative text-left",
            hasValue && onClear ? "pr-16" : "pr-9",
            disabled && "cursor-not-allowed bg-gray-100 dark:bg-muted/50",
            className,
          )}
          onClick={() => store.setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !open) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            store.setOpen(false);
          }}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !hasValue && "text-muted-foreground",
            )}
          >
            {displayLabel}
          </span>
        </button>
        <div
          data-testid="filter-picker-trailing"
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
        >
          {hasValue && onClear ? (
            <button
              type="button"
              aria-label={clearAriaLabel}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClear();
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <ChevronDown
            className="h-4 w-4 shrink-0 opacity-50"
            aria-hidden
          />
        </div>
      </div>
      {open ? (
        <Ariakit.ComboboxPopover
          store={store}
          gutter={8}
          sameWidth
          portal
          fixed
          autoFocusOnShow={false}
          hideOnEscape={(event) => {
            event.stopPropagation();
            return true;
          }}
          hideOnInteractOutside={(event) => {
            const target = event.target;
            if (
              triggerRef.current
              && target instanceof Node
              && triggerRef.current.contains(target)
            ) {
              return false;
            }

            return true;
          }}
          getAnchorRect={() =>
            triggerRef.current?.getBoundingClientRect() ?? null
          }
          data-filter-picker-popover=""
          className={cn(
            filterPickerPopoverClassName,
            "touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]",
            popoverClassName,
          )}
        >
          <div className="shrink-0 border-b bg-popover p-2">
            <Ariakit.Combobox
              store={store}
              placeholder={searchPlaceholder}
              autoSelect={false}
              className={cn(formControlSurfaceClassName, "w-full")}
            />
          </div>
          <div
            data-testid="filter-picker-list"
            className={filterPickerListClassName}
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              overscrollBehavior: "contain",
            }}
          >
            {children({ searchValue, open })}
          </div>
        </Ariakit.ComboboxPopover>
      ) : null}
    </FilterPickerStoreContext.Provider>
  );
};

export default FilterPickerShell;
