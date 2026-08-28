import * as React from "react"
import { cn } from "@/lib/cn"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-ring disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-text-muted disabled:opacity-50",
          error ? "border-alert focus-visible:border-alert focus-visible:ring-alert/30" : "border-border focus-visible:border-brand focus-visible:ring-brand/35",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
