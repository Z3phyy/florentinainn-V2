"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { ownAccessCodeSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { AccessCodeFields } from "@/components/ui/accessCodeFields";
import { KeyRound, Loader2, Save } from "lucide-react";

type Values = z.input<typeof ownAccessCodeSchema>;

const EMPTY: Values = { currentPassword: "", accessCode: "", confirmAccessCode: "" };

export function AccessCodeSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{
    hasAccessCode: boolean;
    accessCodeUpdatedAt: string | null;
  }>({
    queryKey: ["own-access-code"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/access-code");
      return res.data;
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(ownAccessCodeSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: (values: Values) => axiosInstance.put("/system/access-code", values),
    onSuccess: () => {
      successAlert("Your access code was updated. Use the new code the next time you sign in.");
      form.reset(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["own-access-code"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to update access code.")),
  });

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-5 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <KeyRound className="size-4.5 text-[#900546]" />
            My Access Code
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Required after your password every time you sign in. Stored securely hashed — it can be replaced but never viewed.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-40 rounded-full" />
        ) : isError ? (
          <span className="text-xs text-destructive">Status unavailable</span>
        ) : (
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              data?.hasAccessCode
                ? "border-green-600/30 bg-green-600/10 text-green-700"
                : "border-amber-600/30 bg-amber-600/10 text-amber-700"
            }`}
          >
            {data?.hasAccessCode
              ? `Set${data.accessCodeUpdatedAt ? ` · updated ${new Date(data.accessCodeUpdatedAt).toLocaleDateString()}` : ""}`
              : "Not set"}
          </span>
        )}
      </div>

      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        <AccessCodeFields form={form} idPrefix="own" label="New Access Code" disabled={mutation.isPending} />

        <FormField
          id="own-current-password"
          label="Current Password"
          required
          error={errors.currentPassword?.message}
          hint="Confirm it's you before changing the access code."
          className="sm:max-w-sm"
        >
          <PasswordInput
            id="own-current-password"
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword}
            disabled={mutation.isPending}
            {...form.register("currentPassword")}
          />
        </FormField>

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-2xl px-5 py-2.5 bg-[#900546] hover:bg-[#720336] text-white font-semibold text-xs shadow-md shadow-[#900546]/20 cursor-pointer"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              {data?.hasAccessCode ? "Replace Access Code" : "Save Access Code"}
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
