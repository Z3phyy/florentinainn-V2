import { FieldValues, Path, UseFormSetError } from "react-hook-form";

export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): boolean {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return false;
  const errors = (data as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object") return false;
  let applied = false;
  for (const [field, message] of Object.entries(errors as Record<string, unknown>)) {
    if (fields.includes(field) && typeof message === "string") {
      setError(field as Path<T>, { type: "server", message }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}
