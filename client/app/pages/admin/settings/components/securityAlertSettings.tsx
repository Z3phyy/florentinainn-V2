"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { optionalEmailSchema } from "@/app/utils/schemas";
import useUserStore from "@/app/store/useUserStore";
import { systemInterface } from "@/app/types/system.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";

const schema = z.object({
  securityAlertEmail: optionalEmailSchema,
  securityAlertScope: z.enum(["off", "admins", "all"]),
});
type Values = z.input<typeof schema>;

export function SecurityAlertSettings({ systemInfo }: { systemInfo?: systemInterface }) {
  const queryClient = useQueryClient();
  const isSuperAdmin = useUserStore((s) => s.user?.type === "super admin");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { securityAlertEmail: "", securityAlertScope: "admins" },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    form.reset({
      securityAlertEmail: systemInfo?.securityAlertEmail || "",
      securityAlertScope: systemInfo?.securityAlertScope || "admins",
    });
  }, [systemInfo, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) => axiosInstance.put("/system/info", values),
    onSuccess: () => {
      successAlert("Security alert settings saved.");
      queryClient.invalidateQueries({ queryKey: ["systeminfo"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to save security alert settings.")),
  });

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
      <div>
        <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
          <ShieldAlert className="size-4.5 text-[#900546]" />
          Sign-in Security Alerts
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-2xl">
          Every successful staff or admin sign-in (password and access code verified) creates a Security notification for administrators. Alerts never include passwords, access codes, or tokens. Choose which sign-ins are also emailed.
        </p>
      </div>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <FormField id="security-scope" label="Email alerts for" error={errors.securityAlertScope?.message}>
          <Controller
            control={form.control}
            name="securityAlertScope"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!isSuperAdmin}>
                <SelectTrigger id="security-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admins">Admin & super admin sign-ins</SelectItem>
                  <SelectItem value="all">All sign-ins (including staff)</SelectItem>
                  <SelectItem value="off">No emails (in-app only)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          id="security-email"
          label="Alert recipient"
          error={errors.securityAlertEmail?.message}
          hint="Leave empty to use the hotel contact email."
        >
          <Input
            id="security-email"
            type="email"
            placeholder={systemInfo?.contactEmail || "security@hotel.com"}
            disabled={!isSuperAdmin}
            aria-invalid={!!errors.securityAlertEmail}
            {...form.register("securityAlertEmail")}
          />
        </FormField>
        <div className="sm:col-span-2 flex items-center gap-3">
          {isSuperAdmin ? (
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : "Save Alert Settings"}
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground">Only the super admin can change these settings.</p>
          )}
        </div>
      </form>
    </section>
  );
}
