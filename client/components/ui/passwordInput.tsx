"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePasswordVisibility } from "@/app/hooks/usePasswordVisibility";

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const { showPassword, togglePasswordVisibility, passwordInputType } =
    usePasswordVisibility();

  return (
    <div className="relative">
      <Input
        {...props}
        type={passwordInputType}
        disabled={disabled}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={togglePasswordVisibility}
        disabled={disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
