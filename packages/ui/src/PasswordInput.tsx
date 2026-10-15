"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./Input";
import { cn } from "./cn";

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, id, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(className, "pr-12")}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-controls={inputId}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-text-muted hover:text-text focus-visible:outline-none focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
