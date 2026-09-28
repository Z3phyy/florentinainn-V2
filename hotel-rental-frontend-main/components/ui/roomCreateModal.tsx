"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { applyApiFieldErrors } from "@/app/utils/apiFieldErrors";
import { roomCreateSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, X, Upload, Plus } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "maintenance", label: "Maintenance" },
];
const BEDDING_OPTIONS = ["King", "Queen", "Full/Double", "Twin", "2 Queen", "Sofa Bed"];
const ROOM_FIELDS = ["roomNumber", "category", "price", "status", "bedding", "maxHead", "description", "image", "amenities"] as const;

type RoomFormValues = z.input<typeof roomCreateSchema>;

const EMPTY_VALUES: RoomFormValues = {
  roomNumber: "",
  category: "",
  price: "",
  status: "",
  bedding: "",
  maxHead: "",
  description: "",
  image: null,
  amenities: [],
};

export function RoomCreateModal({ variant = "admin" }: { variant?: "admin" | "staff" }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [amenityInput, setAmenityInput] = useState("");

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomCreateSchema),
    mode: "all",
    defaultValues: EMPTY_VALUES,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = form;

  const imageFile = useWatch({ control, name: "image" });
  const amenities = useWatch({ control, name: "amenities" }) || [];

  const imagePreview = useMemo(
    () => (imageFile && typeof File !== "undefined" && imageFile instanceof File ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const resetForm = () => {
    reset(EMPTY_VALUES);
    setAmenityInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addRoomMutation = useMutation({
    mutationFn: (formData: FormData) => axiosInstance.post("/room", formData),
    onSuccess: () => {
      successAlert("Room added successfully.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
      resetForm();
    },
    onError: (err) => {
      const mapped = applyApiFieldErrors(err, setError, ROOM_FIELDS);
      errorAlert(
        mapped
          ? "Please fix the highlighted fields."
          : getApiErrorMessage(err, "Failed to add room."),
      );
    },
  });

  const setImage = (file: File | null) => {
    setValue("image", file, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    if (!file && fileInputRef.current) fileInputRef.current.value = "";
  };

  const addAmenity = () => {
    const trimmed = amenityInput.trim();
    if (trimmed && !amenities.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setValue("amenities", [...amenities, trimmed.slice(0, 40)], { shouldValidate: true, shouldDirty: true });
    }
    setAmenityInput("");
  };

  const removeAmenity = (item: string) => {
    setValue(
      "amenities",
      amenities.filter((a) => a !== item),
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit((values) => {
    const parsed = roomCreateSchema.parse(values);
    const formData = new FormData();
    if (parsed.roomNumber) formData.append("roomNumber", parsed.roomNumber);
    formData.append("category", parsed.category);
    formData.append("price", parsed.price);
    formData.append("discount", "0");
    formData.append("status", parsed.status);
    formData.append("description", parsed.description);
    formData.append("maxHead", parsed.maxHead);
    if (parsed.image) formData.append("image", parsed.image);
    parsed.amenities.forEach((amenity) => formData.append("amenities", amenity));
    if (parsed.bedding) formData.append("bedding", parsed.bedding);
    addRoomMutation.mutate(formData);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {variant === "admin" ? (
          <Button onClick={() => setOpen(true)} className="rounded-xl bg-[#900546] hover:bg-[#720336] text-white shadow-md shadow-[#900546]/20 text-xs font-semibold h-10 px-4 cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            Add Suite
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add Room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={`sm:max-w-[550px] max-h-[90vh] overflow-y-auto ${
          variant === "admin" ? "rounded-3xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]" : ""
        }`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>Create a new room with details, amenities, and pricing.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="roomNumber" label="Room Number / Unit" error={errors.roomNumber?.message}>
              <Input id="roomNumber" placeholder="e.g. 101, 102, 201A" aria-invalid={!!errors.roomNumber} {...register("roomNumber")} />
            </FormField>
            <FormField id="category" label="Category / Type" required error={errors.category?.message}>
              <Input id="category" placeholder="e.g. Deluxe, Suite" aria-invalid={!!errors.category} {...register("category")} />
            </FormField>
          </div>

          <FormField id="price" label="Price per night (₱)" required error={errors.price?.message}>
            <Input id="price" type="number" min={1} step="0.01" inputMode="decimal" placeholder="0.00" aria-invalid={!!errors.price} {...register("price")} />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="status" label="Status" required error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      field.onBlur();
                    }}
                  >
                    <SelectTrigger id="status" className="w-full" aria-invalid={!!errors.status} onBlur={field.onBlur}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="bedding" label="Bed Size" error={errors.bedding?.message}>
              <Controller
                control={control}
                name="bedding"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="bedding" className="w-full">
                      <SelectValue placeholder="Select bed size" />
                    </SelectTrigger>
                    <SelectContent>
                      {BEDDING_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField id="maxHead" label="Max Guests" required error={errors.maxHead?.message}>
            <Input id="maxHead" type="number" min={1} max={20} step={1} placeholder="e.g. 4" aria-invalid={!!errors.maxHead} {...register("maxHead")} />
          </FormField>

          <FormField id="description" label="Description" required error={errors.description?.message} hint="At least 10 characters.">
            <Textarea id="description" placeholder="Room description..." rows={3} aria-invalid={!!errors.description} {...register("description")} />
          </FormField>

          <div className="space-y-1.5">
            <Label>
              Room Image <span className="text-rose-600" aria-hidden="true">*</span>
            </Label>
            <div
              role="button"
              tabIndex={0}
              aria-describedby={errors.image ? "room-image-error" : undefined}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
                errors.image ? "border-destructive" : "border-border hover:border-muted-foreground/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {imagePreview ? (
                <div className="relative w-full">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-md" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImage(null);
                    }}
                    className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select an image</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP up to 10 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
            {errors.image?.message ? (
              <p id="room-image-error" role="alert" className="text-xs font-medium text-destructive">{errors.image.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amenity-input">Amenities</Label>
            <div className="flex gap-2">
              <Input
                id="amenity-input"
                placeholder="e.g. WiFi, AC, TV"
                value={amenityInput}
                maxLength={40}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAmenity();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
            </div>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {amenities.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                    {item}
                    <button type="button" aria-label={`Remove ${item}`} onClick={() => removeAmenity(item)} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.amenities?.message ? (
              <p role="alert" className="text-xs font-medium text-destructive">{errors.amenities.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" disabled={addRoomMutation.isPending}>
              {addRoomMutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
