"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { guestRecordSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil } from "lucide-react";
import type { GuestDirectoryEntry } from "../page";

type Values = z.input<typeof guestRecordSchema>;

const valuesFromGuest = (guest: GuestDirectoryEntry): Values => ({
  name: guest.name || "",
  email: guest.email || "",
  phone: guest.phone || "",
  address: guest.address || "",
});

export function EditGuestModal({ guest }: { guest: GuestDirectoryEntry }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(guestRecordSchema),
    mode: "onTouched",
    defaultValues: valuesFromGuest(guest),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Values) =>
      axiosInstance.put("/booking/directory", {
        key: guest.key,
        clientName: values.name.trim(),
        clientEmail: values.email.trim(),
        clientPhone: values.phone.trim(),
        clientAddress: values.address.trim(),
      }),
    onSuccess: () => {
      successAlert("Guest record updated across their bookings.");
      queryClient.invalidateQueries({ queryKey: ["guest-directory"] });
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["reservation-history"] });
      setOpen(false);
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to update guest record."));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(valuesFromGuest(guest));
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Edit guest record"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit Guest Record</DialogTitle>
          <DialogDescription>
            Updates the contact details on all bookings for this guest (
            {guest.totalStays} record{guest.totalStays !== 1 ? "s" : ""}).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <FormField id="guest-name" label="Guest Name" required error={errors.name?.message}>
            <Input id="guest-name" aria-invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField id="guest-email" label="Email" error={errors.email?.message}>
            <Input
              id="guest-email"
              type="email"
              aria-invalid={!!errors.email}
              {...register("email", { onChange: () => trigger("phone") })}
            />
          </FormField>
          <FormField
            id="guest-phone"
            label="Phone"
            error={errors.phone?.message}
            hint="An email or phone number is required."
          >
            <Input id="guest-phone" aria-invalid={!!errors.phone} {...register("phone")} />
          </FormField>
          <FormField id="guest-address" label="Address" required error={errors.address?.message}>
            <Input id="guest-address" aria-invalid={!!errors.address} {...register("address")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Record"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
