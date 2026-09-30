import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "lm-button inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-pill text-[13px] font-semibold transition-all duration-150 ease-out focus-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border border-navy bg-navy text-cream hover:bg-navy-2 hover:shadow-md dark:border-gold dark:bg-gold dark:text-navy dark:hover:bg-gold-soft",
        gold:
          "border border-gold bg-gold text-navy hover:bg-gold-soft hover:shadow-md",
        outline:
          "border border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-inset hover:text-text",
        "outline-cream":
          "border border-cream/35 text-cream hover:bg-cream/10 hover:border-gold-soft",
        ghost: "hover:bg-surface-inset text-text-muted hover:text-text",
        danger:
          "border border-danger bg-danger text-white hover:bg-danger/90 hover:shadow-md",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, ...props }, ref) => {
    // If asChild is true, clone the first child element and apply button classes to it.
    // This avoids needing @radix-ui/react-slot as a dependency.
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
        className: cn(buttonVariants({ variant, size, className }), (children as React.ReactElement<{ className?: string }>).props.className),
      })
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
