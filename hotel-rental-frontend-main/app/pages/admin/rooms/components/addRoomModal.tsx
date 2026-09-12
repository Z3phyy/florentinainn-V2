"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const CATEGORY_OPTIONS = ["Standard", "Deluxe", "Suite", "Penthouse", "Single", "Double", "Family"];
const STATUS_OPTIONS = ["available", "occupied", "maintenance"];
const BEDDING_OPTIONS = ["King", "Queen", "Full/Double", "Twin", "2 Queen", "Sofa Bed"];

export function AddRoomModal() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const [roomNumber, setRoomNumber] = useState("");
  const [category, setCategory] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [beddingValue, setBeddingValue] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [maxHead, setMaxHead] = useState("");

  const addRoomMutation = useMutation({
    mutationFn: (formData: FormData) =>
      axiosInstance.post("/room", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      successAlert("Room added successfully.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
      resetForm();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to add room.";
      errorAlert(message);
    },
  });

  const resetForm = () => {
    setRoomNumber("");
    setCategory("");
    setAmenities([]);
    setAmenityInput("");
    setBeddingValue("");
    setPrice("");
    setImageFile(null);
    setImagePreview(null);
    setDescription("");
    setStatus("");
    setMaxHead("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
    else setImagePreview(null);
  };

  const addAmenity = () => {
    const trimmed = amenityInput.trim();
    if (trimmed && !amenities.includes(trimmed)) {
      setAmenities([...amenities, trimmed]);
    }
    setAmenityInput("");
  };

  const removeAmenity = (item: string) => {
    setAmenities(amenities.filter((a) => a !== item));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !price || !status || !maxHead) {
      errorAlert("Please fill in all required fields.");
      return;
    }

    const formData = new FormData();
    if (roomNumber.trim()) formData.append("roomNumber", roomNumber.trim());
    formData.append("category", category);
    formData.append("price", price);
    formData.append("discount", "0");
    formData.append("status", status);
    if (description) formData.append("description", description);
    if (maxHead) formData.append("maxHead", maxHead);
    if (imageFile) formData.append("image", imageFile);
    amenities.forEach((amenity) => formData.append("amenities", amenity));
    if (beddingValue) formData.append("bedding", beddingValue);

    addRoomMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} className="rounded-xl bg-[#900546] hover:bg-[#720336] text-white shadow-md shadow-[#900546]/20 text-xs font-semibold h-10 px-4 cursor-pointer">
          <Plus className="size-4 mr-1.5" />
          Add Suite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-3xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>Create a new room with details, amenities, and pricing.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Room Number */}
            <div className="space-y-2">
              <Label htmlFor="roomNumber">Room Number / Unit</Label>
              <Input
                id="roomNumber"
                type="text"
                placeholder="e.g. 101, 102, 201A"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category / Type <span className="text-destructive">*</span></Label>
              <Input
                id="category"
                type="text"
                placeholder="e.g. Deluxe, Suite"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price <span className="text-destructive">*</span></Label>
            <Input id="price" type="number" min={0} placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>

          {/* Status & Bedding */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status <span className="text-destructive">*</span></Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bed Size</Label>
              <Select value={beddingValue} onValueChange={setBeddingValue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select bed size" />
                </SelectTrigger>
                <SelectContent>
                  {BEDDING_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Max Head Count */}
          <div className="space-y-2">
            <Label htmlFor="maxHead">Max Guests <span className="text-destructive">*</span></Label>
            <Input id="maxHead" type="number" min={1} placeholder="e.g. 4" value={maxHead} onChange={(e) => setMaxHead(e.target.value)} required />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Room description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Room Image</Label>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-muted-foreground/50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {imagePreview ? (
                <div className="relative w-full">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-md" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><X className="size-3" /></button>
                </div>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select an image</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. WiFi, AC, TV" value={amenityInput} onChange={(e) => setAmenityInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity(); } }} />
              <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
            </div>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {amenities.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                    {item}
                    <button type="button" onClick={() => removeAmenity(item)} className="text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            )}
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
