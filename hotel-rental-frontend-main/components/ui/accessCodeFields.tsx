"use client";

import { useState } from "react";
import {
  FieldValues,
  Path,
  PathValue,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import { Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { generateAccessCode } from "@/app/utils/accessCode";

type AccessCodeFormShape = FieldValues & {
  accessCode: string;
  confirmAccessCode: string;
};

export function AccessCodeFields<T extends AccessCodeFormShape>({
  form,
  idPrefix,
  label = "Access Code",
  disabled,
}: {
  form: UseFormReturn<T>;
  idPrefix: string;
  label?: string;
  disabled?: boolean;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const errors = form.formState.errors;
  const codeName = "accessCode" as Path<T>;
  const confirmName = "confirmAccessCode" as Path<T>;
  const currentCode = useWatch({ control: form.control, name: codeName });
  const visibleGenerated =
    generated && String(currentCode || "").toUpperCase() === generated ? generated : null;
  const codeError = errors.accessCode?.message as string | undefined;
  const confirmError = errors.confirmAccessCode?.message as string | undefined;

  const handleGenerate = () => {
    const code = generateAccessCode();
    const value = code as PathValue<T, Path<T>>;
    form.setValue(codeName, value, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
    form.setValue(confirmName, value, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
    setGenerated(code);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!visibleGenerated) return;
    try {
      await navigator.clipboard.writeText(visibleGenerated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          id={`${idPrefix}-access-code`}
          label={label}
          required
          error={codeError}
          hint="6–20 letters or numbers. Not case-sensitive."
        >
          <PasswordInput
            id={`${idPrefix}-access-code`}
            autoComplete="new-password"
            maxLength={20}
            disabled={disabled}
            className="font-mono uppercase tracking-widest"
            aria-invalid={!!codeError}
            aria-describedby={`${idPrefix}-access-code-error`}
            {...form.register(codeName, {
              onChange: () => {
                if (form.getFieldState(confirmName).isTouched) {
                  form.trigger(confirmName);
                }
              },
            })}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-confirm-access-code`}
          label={`Confirm ${label}`}
          required
          error={confirmError}
        >
          <PasswordInput
            id={`${idPrefix}-confirm-access-code`}
            autoComplete="new-password"
            maxLength={20}
            disabled={disabled}
            className="font-mono uppercase tracking-widest"
            aria-invalid={!!confirmError}
            aria-describedby={`${idPrefix}-confirm-access-code-error`}
            {...form.register(confirmName)}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={disabled}>
          <Sparkles className="size-3.5" />
          Generate secure code
        </Button>
        {visibleGenerated && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#900546]/40 bg-[#900546]/5 px-2.5 py-1">
            <span className="font-mono text-sm font-semibold tracking-[0.2em]">{visibleGenerated}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Copy generated access code"
            >
              {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        )}
      </div>
      {visibleGenerated && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Copy this code now and share it securely. It cannot be viewed again after saving.
        </p>
      )}
    </div>
  );
}
