import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RequiredMark() {
  return (
    <span className="text-rose-600" aria-hidden="true">
      *
    </span>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  className,
  labelClassName,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
