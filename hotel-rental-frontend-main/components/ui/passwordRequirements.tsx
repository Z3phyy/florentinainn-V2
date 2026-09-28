"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/app/utils/validation";

interface Props {
  password: string;
}

export function PasswordRequirements({ password }: Props) {
  const rules = PASSWORD_RULES.map((rule) => ({
    label: rule.label,
    met: rule.test(password),
  }));

  return (
    <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5 space-y-1.5 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Password Requirements:
      </p>
      <div className="space-y-1">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 transition-colors text-[11px] ${
              rule.met
                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {rule.met ? (
              <div className="size-3.5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check className="size-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              </div>
            ) : (
              <Circle className="size-3 text-muted-foreground/50 shrink-0" />
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
