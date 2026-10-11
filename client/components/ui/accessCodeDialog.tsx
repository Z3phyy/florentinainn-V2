"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { accessCodePairSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccessCodeFields } from "@/components/ui/accessCodeFields";

type Values = z.input<typeof accessCodePairSchema>;

export function AccessCodeDialog({
  targetId,
  targetName,
  endpoint,
  hasAccessCode,
  invalidateKey,
}: {
  targetId: string;
  targetName: string;
  endpoint: "/account/access-code" | "/system/admin/access-code";
  hasAccessCode?: boolean;
  invalidateKey: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(accessCodePairSchema),
    mode: "onTouched",
    defaultValues: { accessCode: "", confirmAccessCode: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      axiosInstance.put(endpoint, {
        _id: targetId,
        accessCode: values.accessCode,
        confirmAccessCode: values.confirmAccessCode,
      }),
    onSuccess: () => {
      successAlert(`Access code saved for ${targetName}.`);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to save the access code.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={hasAccessCode ? "Change access code" : "Assign access code"}
          aria-label={hasAccessCode ? "Change access code" : "Assign access code"}
        >
          <KeyRound className={`size-3.5 ${hasAccessCode ? "text-[#900546]" : "text-amber-600"}`} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{hasAccessCode ? "Change Access Code" : "Assign Access Code"}</DialogTitle>
          <DialogDescription>
            {targetName} must enter this code after their password to sign in.
            {hasAccessCode ? " The previous code stops working immediately." : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <AccessCodeFields form={form} idPrefix={`code-${targetId}`} disabled={mutation.isPending} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Access Code"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
