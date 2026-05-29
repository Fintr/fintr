"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const searchFieldInputClassName = cn(
  "h-auto min-h-9 w-full max-w-none border-0 bg-white p-2 pl-10 shadow-sm",
  "focus-visible:border-transparent focus-visible:ring-0",
);

export type SearchFieldProps = React.ComponentProps<typeof Input> & {
  wrapperClassName?: string;
  iconClassName?: string;
};

export function SearchField({
  className,
  wrapperClassName,
  iconClassName,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn("relative min-w-0 flex-1 w-full", wrapperClassName)}>
      <Search
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400",
          iconClassName,
        )}
        aria-hidden
      />
      <Input
        className={cn(searchFieldInputClassName, className)}
        {...props}
      />
    </div>
  );
}

export default SearchField;
