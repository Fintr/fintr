import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import { OptionType } from "@/types/generalTypes";

/**
 * An item can be a simple string or an object with label and value
 */
export type ComboBoxItem = string | OptionType;

/**
 * Props for the ComboBox component
 */
export interface ComboBoxProps {
  /**
   * The type of filtering to apply
   * - "frontend": Filtering happens on the client side using the provided data
   * - "backend": Filtering makes API calls based on the user's input
   */
  filterType: "frontend" | "backend";
  /**
   * The data to filter (required for frontend filtering)
   */
  data?: ComboBoxItem[];
  /**
   * Function to fetch options from backend (required for backend filtering)
   */
  fetchOptions?: (query: string) => Promise<ComboBoxItem[]>;
  /**
   * The label for the combobox
   */
  label?: string;
  /**
   * The placeholder text
   */
  placeholder?: string;
  /**
   * The current value of the combobox
   */
  value?: string;
  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void;
  /**
   * Minimum characters required to trigger search/filtering
   */
  minSearchLength?: number;
  /**
   * Debounce time in milliseconds for backend search
   */
  debounceTime?: number;
  /**
   * Class name to apply to the combobox input
   */
  className?: string;
  /**
   * Class name to apply to the combobox popover
   */
  popoverClassName?: string;
  /**
   * Class name to apply to the combobox item
   */
  itemClassName?: string;
  /**
   * Whether the combobox is disabled
   */
  disabled?: boolean;
  /**
   * Whether to show all options when the combobox is focused
   * @default true
   */
  showAllOnFocus?: boolean;
  /**
   * Custom renderer for the "not found" state.
   * Receives the current search value and a function to select the value and close the popover.
   */
  renderNotFound?: (searchValue: string, selectValueAndClose: () => void) => React.ReactNode;
  /**
   * When provided, the input shows this label when closed (e.g. flag + name) instead of the raw value.
   * When the popover opens, the input reverts to the raw value so the user can type to search.
   */
  getDisplayLabel?: (value: string) => string;
  /**
   * Maximum number of options to show in the dropdown (e.g. 5). Omit to show all.
   */
  maxVisibleOptions?: number;
}

export const ComboBox = ({
  filterType,
  data = [],
  fetchOptions,
  label,
  placeholder = "Search...",
  value,
  onChange,
  minSearchLength = 1,
  debounceTime = SEARCH_DEBOUNCE_MS,
  className,
  popoverClassName,
  itemClassName,
  disabled = false,
  showAllOnFocus = true,
  renderNotFound,
  getDisplayLabel,
  maxVisibleOptions,
}: ComboBoxProps) => {
  const [searchValue, setSearchValue] = useState(
    () => (value != null && getDisplayLabel ? getDisplayLabel(value) : value ?? "")
  );
  const [options, setOptions] = useState<ComboBoxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Initialize searchValue from value prop on mount
  useEffect(() => {
    if (value !== undefined && value !== null) {
      setSearchValue(getDisplayLabel ? getDisplayLabel(value) : value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // When closed: show display label (flag + name) or raw value. When open: show raw value for searching.
  useEffect(() => {
    if (!open && value !== undefined && value !== null) {
      setSearchValue(getDisplayLabel ? getDisplayLabel(value) : value);
    }
  }, [value, open, getDisplayLabel]);

  // When opening, switch to raw value once so user can type to search (don't reset while open)
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open && !prevOpen.current && value != null && getDisplayLabel) {
      setSearchValue(value);
    }
    prevOpen.current = open;
  }, [open, value, getDisplayLabel]);

  // For frontend filtering
  const filteredOptions = useMemo(() => {
    if (filterType !== "frontend" || !data) return [];
    if (showAllOnFocus && open && searchValue.length === 0) return data;
    if (searchValue.length < minSearchLength && !(showAllOnFocus && open)) return [];
    
    return matchSorter(data, searchValue, {
      keys: ["label", "value", String],
    });
  }, [filterType, data, searchValue, minSearchLength, open, showAllOnFocus]);

  // For backend filtering
  useEffect(() => {
    if (filterType !== "backend" || !fetchOptions) return;
    
    if (showAllOnFocus && open && searchValue.length === 0) {
      setLoading(true);
      fetchOptions('')
        .then(result => setOptions(result))
        .catch(error => {
          console.error("Error fetching initial options:", error);
          setOptions([]);
        })
        .finally(() => setLoading(false));
      return;
    }
    
    if (searchValue.length < minSearchLength && !(showAllOnFocus && open)) {
      setOptions([]);
      return;
    }

    const newTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchOptions(searchValue);
        setOptions(result);
      } catch (error) {
        console.error("Error fetching options:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, debounceTime);

    return () => {
      clearTimeout(newTimer);
    };
  }, [searchValue, fetchOptions, filterType, minSearchLength, debounceTime, open, showAllOnFocus]);

  // Handler for value changes
  const handleChange = (value: string) => {
    setSearchValue(value);
    if (onChange) {
      onChange(value);
    }
    // Do not automatically close here, selection of an item or explicit action should close.
  };

  // Get the appropriate options based on filtering type; optionally cap visible count
  const displayOptions = filterType === "frontend" ? filteredOptions : options;
  const visibleOptions =
    maxVisibleOptions != null
      ? displayOptions.slice(0, maxVisibleOptions)
      : displayOptions;

  // Format items for display
  const formatItem = (item: ComboBoxItem): { display: string; value: string } => {
    if (typeof item === "string") {
      return { display: item, value: item };
    }
    return { display: item.label, value: String(item.value) };
  };

  const combobox = Ariakit.useComboboxContext();

  return (
    <Ariakit.ComboboxProvider
      setValue={(value) => {
        startTransition(() => handleChange(value));
      }}
      value={searchValue}
      open={open}
      setOpen={setOpen}
    >
      {label && (
        <Ariakit.ComboboxLabel className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </Ariakit.ComboboxLabel>
      )}
      <Ariakit.Combobox 
        placeholder={placeholder} 
        className={cn(
          "flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-full",
          disabled && "bg-gray-100 cursor-not-allowed",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      />
      <Ariakit.ComboboxPopover 
        gutter={8} 
        sameWidth 
        className={cn(
          "relative z-[100] max-h-96 min-w-[8rem] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 py-1",
          popoverClassName
        )}
      >
        {loading ? (
          <div className="p-2 text-center text-gray-300">Loading...</div>
        ) : visibleOptions && visibleOptions.length > 0 ? (
          visibleOptions.map((item) => {
            const { display, value: itemValue } = formatItem(item);
            return (
              <Ariakit.ComboboxItem
                key={itemValue}
                value={itemValue}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  itemClassName
                )}
                onSelect={() => {
                  setOpen(false);
                }}
              >
                <span className="w-full hover:bg-accent px-2 py-1 rounded-sm">
                  {display}
                </span>
              </Ariakit.ComboboxItem>
            );
          })
        ) : ((searchValue.length >= minSearchLength && !(showAllOnFocus && open && searchValue.length === 0 && filterType === "frontend")) ||
          (showAllOnFocus && open && searchValue.length === 0)) &&
        !loading ? (
          renderNotFound && searchValue.length > 0 ? (
            renderNotFound(searchValue, () => {
              if (onChange) {
                onChange(searchValue);
              }
              // Ensure Ariakit's state is also updated if possible, or rely on external value prop change.
              // Calling combobox.setValue will trigger the provider's setValue flow.
              if (combobox) {
                combobox.setValue(searchValue);
              }
              setOpen(false);
            })
          ) : (
            <div className="p-2 text-center text-gray-300 text-sm">No results found</div>
          )
        ) : null}
      </Ariakit.ComboboxPopover>
    </Ariakit.ComboboxProvider>
  );
};

export default ComboBox; 
