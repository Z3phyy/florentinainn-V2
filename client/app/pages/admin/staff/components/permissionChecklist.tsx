"use client";

import { useId } from "react";
import { permissionOption } from "@/app/types/account.type";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  options: permissionOption[];
  value: string[];
  onChange: (next: string[]) => void;
  isLoading?: boolean;
  isError?: boolean;
  disabled?: boolean;
}

export function PermissionChecklist({
  options,
  value,
  onChange,
  isLoading,
  isError,
  disabled,
}: Props) {
  const baseId = useId();
  const allValues = options.map((o) => o.value);
  const selectedCount = allValues.filter((v) => value.includes(v)).length;
  const allSelected = allValues.length > 0 && selectedCount === allValues.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleAll = () => {
    onChange(allSelected ? [] : allValues);
  };

  const toggleOne = (permission: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...value, permission])]
      : value.filter((p) => p !== permission);
    onChange(allValues.filter((v) => next.includes(v)));
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-destructive">
        Failed to load the permission list. Close the dialog and try again.
      </p>
    );
  }

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">No permissions available.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#900546]/30 bg-[#900546]/5 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id={`${baseId}-all`}
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            disabled={disabled}
            aria-label="Select all permissions"
          />
          <label htmlFor={`${baseId}-all`} className="cursor-pointer text-sm font-semibold">
            All Permissions
          </label>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {selectedCount} / {allValues.length} selected
        </span>
      </div>

      <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {options.map((perm) => {
          const id = `${baseId}-${perm.value.replace(/\s+/g, "-")}`;
          const checked = value.includes(perm.value);
          return (
            <div
              key={perm.value}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                checked ? "border-[#900546]/40 bg-[#900546]/5" : "border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={checked}
                onCheckedChange={(state) => toggleOne(perm.value, state === true)}
                disabled={disabled}
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm capitalize">{perm.value}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {perm.operations.join(", ")}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
