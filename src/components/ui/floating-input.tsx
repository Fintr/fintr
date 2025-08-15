import * as React from "react"
import { cn } from "@/lib/utils"

export interface FloatingInputProps extends React.ComponentProps<"input"> {
  label: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, type = "text", label, id, ...props }, ref) => {
    const inputId = id || React.useId();
    
    return (
      <div className="relative">
        <input
          type={type}
          id={inputId}
          ref={ref}
          className={cn(
            "block px-2.5 pb-2.5 pt-4 w-full text-sm text-primary bg-transparent rounded-lg border border-input appearance-none",
            "focus:outline-none focus:ring-0 focus:border-primary peer",
            "transition-colors duration-200",
            className
          )}
          placeholder=" "
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute text-sm text-muted-foreground duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2",
            "peer-focus:px-2 peer-focus:text-primary",
            "peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2",
            "peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4",
            "rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1"
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)

FloatingInput.displayName = "FloatingInput"

export { FloatingInput }
