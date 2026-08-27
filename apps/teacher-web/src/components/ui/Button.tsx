import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-medium transition-all duration-200 ease-out focus-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-navy text-cream hover:bg-navy-2 hover:shadow-lg hover:scale-[1.02] dark:bg-gold dark:text-navy dark:hover:bg-gold-soft",
        gold:
          "bg-gold text-white hover:bg-gold-soft hover:shadow-xl hover:scale-[1.02]",
        outline:
          "border-[1.5px] border-border text-navy dark:text-text hover:bg-gold/10 hover:border-gold",
        "outline-cream":
          "border-[1.5px] border-cream/35 text-cream hover:bg-cream/10 hover:border-gold-soft",
        ghost: "hover:bg-surface-inset text-text-muted hover:text-text",
        danger:
          "bg-danger text-white hover:bg-danger/90 hover:shadow-md hover:-translate-y-[2px]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-pill px-4 text-xs",
        lg: "h-12 rounded-pill px-8 text-base",
        icon: "h-11 w-11",
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
