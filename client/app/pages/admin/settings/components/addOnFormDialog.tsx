"use client";

import { ReactNode, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { addOnFormSchema } from "@/app/utils/schemas";
import { addOnInterface } from "@/app/types/addOn.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/formField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type Values = z.input<typeof addOnFormSchema>;

const toValues = (addOn?: addOnInterface): Values => ({
  name: addOn?.name || "",
  description: addOn?.description || "",
  price: addOn ? String(addOn.price) : "",
  pricingUnit: addOn?.pricingUnit || "per_stay",
  maxPerBooking: addOn ? String(addOn.maxPerBooking) : "1",
  stock: addOn && addOn.stock !== null && addOn.stock !== undefined ? String(addOn.stock) : "",
  isActive: addOn ? addOn.isActive : true,
});

export function AddOnFormDialog({ addOn, trigger }: { addOn?: addOnInterface; trigger: ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(addOnFormSchema),
    mode: "all",
    defaultValues: toValues(addOn),
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof addOnFormSchema>) => {
      const payload = {
        name: values.name,
        description: values.description,
        price: Number(values.price),
        pricingUnit: values.pricingUnit,
        maxPerBooking: Number(values.maxPerBooking),
        stock: values.stock === "" ? null : Number(values.stock),
        isActive: values.isActive,
      };
      return addOn
        ? axiosInstance.put(`/addons/${addOn._id}`, payload)
        : axiosInstance.post("/addons", payload);
    },
    onSuccess: () => {
      successAlert(addOn ? "Add-on updated. Existing bookings keep their original price." : "Add-on created.");
      queryClient.invalidateQueries({ queryKey: ["addons-manage"] });
      queryClient.invalidateQueries({ queryKey: ["addons"] });
      setOpen(false);
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to save add-on.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(toValues(addOn));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{addOn ? "Edit Add-on" : "New Add-on"}</DialogTitle>
          <DialogDescription>
            Guests can request add-ons when reserving. Prices are charged by the server and added to the reservation bill.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(addOnFormSchema.parse(values)))}
          className="space-y-4"
          noValidate
        >
          <FormField id="addon-name" label="Name" required error={errors.name?.message}>
            <Input id="addon-name" placeholder="e.g. Extra Bed" aria-invalid={!!errors.name} {...form.register("name")} />
          </FormField>
          <FormField id="addon-description" label="Description" error={errors.description?.message}>
            <Textarea id="addon-description" rows={2} aria-invalid={!!errors.description} {...form.register("description")} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="addon-price" label="Price (₱)" required error={errors.price?.message}>
              <Input id="addon-price" type="number" min={0} step="0.01" aria-invalid={!!errors.price} {...form.register("price")} />
            </FormField>
            <FormField id="addon-unit" label="Charged" required error={errors.pricingUnit?.message}>
              <Controller
                control={form.control}
                name="pricingUnit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="addon-unit" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_stay">Once per stay</SelectItem>
                      <SelectItem value="per_night">Per night</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="addon-max" label="Max per booking" required error={errors.maxPerBooking?.message}>
              <Input id="addon-max" type="number" min={1} max={100} step={1} aria-invalid={!!errors.maxPerBooking} {...form.register("maxPerBooking")} />
            </FormField>
            <FormField id="addon-stock" label="Stock available" error={errors.stock?.message} hint="Empty = unlimited. Limits units booked on overlapping dates.">
              <Input id="addon-stock" type="number" min={0} step={1} placeholder="Unlimited" aria-invalid={!!errors.stock} {...form.register("stock")} />
            </FormField>
          </div>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox id="addon-active" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <label htmlFor="addon-active" className="text-sm">Available to guests</label>
              </div>
            )}
          />
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
              ) : addOn ? (
                "Save Changes"
              ) : (
                "Create Add-on"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
