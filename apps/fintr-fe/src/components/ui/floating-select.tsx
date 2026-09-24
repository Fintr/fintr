import * as React from "react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface FloatingSelectProps {
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
  options?: Array<{ value: string; label: string }>;
  id?: string;
}

const FloatingSelect = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  FloatingSelectProps
>(({ className, label, value, onValueChange, placeholder, children, options, id, ...props }, ref) => {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  const hasValue = value && value.length > 0;
  
  return (
    <div className="relative">
      <Select value={value} onValueChange={onValueChange} {...props}>
        <SelectTrigger
          ref={ref}
          id={selectId}
          className={cn(
            "peer flex h-[48px] min-h-[48px] w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 pb-2.5 pt-4 text-sm text-foreground",
            "dark:border-border dark:bg-input/30",
            "focus:border-primary focus:outline-none focus:ring-0 dark:focus:border-primary-dark-mode",
            "transition-colors duration-200",
            "[&>span]:text-left [&>span]:truncate [&>span]:leading-tight [&>span]:flex-1",
            "[&_svg]:opacity-50 [&_svg]:flex-shrink-0", // Style and position the dropdown arrow
            hasValue ? "[&>span]:opacity-100" : "[&>span]:opacity-0",
            className
          )}
        >
          <SelectValue placeholder={placeholder || " "} />
        </SelectTrigger>
        <SelectContent>
          {children || (
            options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <label
        htmlFor={selectId}
        className={cn(
          "absolute text-sm text-muted-foreground duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-card px-2",
          "peer-focus:px-2 peer-focus:text-primary dark:peer-focus:text-primary-dark-mode",
          "rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1",
          hasValue
            ? "scale-75 -translate-y-4 top-2"
            : "scale-100 -translate-y-1/2 top-1/2 peer-focus:scale-75 peer-focus:-translate-y-4 peer-focus:top-2"
        )}
      >
        {label}
      </label>
    </div>
  )
})

FloatingSelect.displayName = "FloatingSelect"

export { FloatingSelect }
