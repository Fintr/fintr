import * as Ariakit from "@ariakit/react";
import { matchSorter } from "match-sorter";
import { startTransition, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  debounceTime = 300,
  className,
  popoverClassName,
  itemClassName,
  disabled = false,
  showAllOnFocus = true,
  renderNotFound,
}: ComboBoxProps) => {
  const [searchValue, setSearchValue] = useState(value || "");
  const [options, setOptions] = useState<ComboBoxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [open, setOpen] = useState(false);

  // Sync searchValue with the value prop
  useEffect(() => {
    // Update searchValue if the external value prop changes,
    // but only if it's different from the current searchValue to avoid potential loops
    // and ensure that typing is not interrupted.
    if (value !== undefined && value !== searchValue) {
      setSearchValue(value);
    }
  }, [value, searchValue]);

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

    if (timer) {
      clearTimeout(timer);
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

    setTimer(newTimer);

    return () => {
      if (newTimer) clearTimeout(newTimer);
    };
  }, [searchValue, fetchOptions, filterType, minSearchLength, debounceTime, open, showAllOnFocus, timer]);

  // Handler for value changes
  const handleChange = (value: string) => {
    setSearchValue(value);
    if (onChange) {
      onChange(value);
    }
    // Do not automatically close here, selection of an item or explicit action should close.
  };

  // Get the appropriate options based on filtering type
  const displayOptions = filterType === "frontend" ? filteredOptions : options;

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
        ) : displayOptions && displayOptions.length > 0 ? (
          displayOptions.map((item) => {
            const { display, value: itemValue } = formatItem(item);
            return (
              <Ariakit.ComboboxItem
                key={itemValue}
                value={itemValue}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm px-1 text-sm outline-none focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  itemClassName
                )}
              >
                <span className="w-full hover:bg-accent px-2 py-1 rounded-sm">
                  {display}
                </span>
              </Ariakit.ComboboxItem>
            );
          })
        ) : ((searchValue.length >= minSearchLength && !(showAllOnFocus && open && searchValue.length === 0 && filterType === 'frontend')) || (showAllOnFocus && open && searchValue.length === 0)) && !loading ? (
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
