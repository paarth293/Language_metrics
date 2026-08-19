import * as React from "react"
import { cn } from "@/lib/cn"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, initials, size = "md", online, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-14 w-14 text-base",
      xl: "h-20 w-20 text-xl",
    }

    return (
      <div ref={ref} className={cn("relative inline-block", className)} {...props}>
        <div
          className={cn(
            "relative flex shrink-0 overflow-hidden rounded-full bg-surface-inset items-center justify-center font-medium text-text-muted ring-1 ring-border",
            sizeClasses[size]
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || "Avatar"}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {online && (
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar }
