"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Loader2,
  Plus,
  X,
  Sparkles,
  Upload,
  ImageIcon,
} from "lucide-react";

interface Props {
  room: roomInterface;
}

const BEDDING_OPTIONS = ["King", "Queen", "Full/Double", "Twin", "2 Queen", "Sofa Bed"];

export function EditRoomModal({ room }: Props) {
  const queryClient = useQueryClient();
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [category, setCategory] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [beddingValue, setBeddingValue] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [maxHead, setMaxHead] = useState("");

  // Thumbnail states
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");

  // Pre-populate fields when modal opens
  useEffect(() => {
    if (open) {
      setRoomNumber(room.roomNumber || "");
      setCategory(room.category || "");
      setAmenities(room.amenities || []);
      setBeddingValue(room.bedding?.[0] || "");
      setPrice(String(room.price || ""));
      setDescription(room.description || "");
      setStatus(room.status || "available");
      setMaxHead(String(room.maxHead || ""));

      // Initialize thumbnail
      setThumbnailFile(null);
      setThumbnailPreview(room.image || "");
    }
  }, [open, room]);

  const editRoomMutation = useMutation({
    mutationFn: (formData: FormData) =>
      axiosInstance.put("/room", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      successAlert("Room updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to update room.";
      errorAlert(message);
    },
  });

  const handleThumbnailChange = (file: File | null) => {
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
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
    formData.append("_id", room._id);
    formData.append("roomNumber", roomNumber.trim());
    formData.append("category", category);
    formData.append("price", String(Number(price)));
    formData.append("discount", String(room.discount || 0));
    formData.append("status", status);
    formData.append("maxHead", String(Number(maxHead)));
    formData.append("description", description);
    formData.append("maintenance", room.maintenance || "");
    formData.append("amenities", JSON.stringify(amenities));
    if (beddingValue) formData.append("bedding", JSON.stringify([beddingValue]));
    formData.append("housekeeping", JSON.stringify(room.housekeeping || []));

    // Thumbnail: if new file selected, send file; otherwise send existing string URL
    if (thumbnailFile) {
      formData.append("image", thumbnailFile);
    } else {
      formData.append("image", thumbnailPreview);
    }

    // Preserve existing gallery images
    formData.append("images", JSON.stringify(room.images || []));

    editRoomMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>Update room details, thumbnail cover photo, and amenities.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── THUMBNAIL (COVER PHOTO) SECTION ── */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3.5">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <ImageIcon className="size-4 text-muted-foreground" />
              Room Thumbnail (Cover Image)
            </Label>
            <div className="flex items-center gap-4 pt-1">
              {thumbnailPreview ? (
                <div className="relative size-20 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="size-full object-cover" />
                  {thumbnailFile && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-[9px] text-primary-foreground text-center py-0.5 font-medium">
                      New
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-xs text-muted-foreground shrink-0">
                  No Image
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="size-3.5" />
                  {thumbnailPreview ? "Change Thumbnail" : "Upload Thumbnail"}
                </Button>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <p className="text-[11px] text-muted-foreground">
                  This image will be displayed on room listings and cards.
                </p>
              </div>
            </div>
          </div>

          {/* ── ROOM DETAILS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Room Number */}
            <div className="space-y-2">
              <Label htmlFor="edit-roomNumber">Room Number / Unit</Label>
              <Input
                id="edit-roomNumber"
                type="text"
                placeholder="e.g. 101, 102, 201A"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="edit-category">Room Category <span className="text-destructive">*</span></Label>
              <Input
                id="edit-category"
                type="text"
                placeholder="e.g. Deluxe Room"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price (₱) <span className="text-destructive">*</span></Label>
              <Input
                id="edit-price"
                type="number"
                min={0}
                placeholder="e.g. 2500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            {/* Max Head */}
            <div className="space-y-2">
              <Label htmlFor="edit-maxHead">Max Guests <span className="text-destructive">*</span></Label>
              <Input
                id="edit-maxHead"
                type="number"
                min={1}
                placeholder="e.g. 2"
                value={maxHead}
                onChange={(e) => setMaxHead(e.target.value)}
                required
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status <span className="text-destructive">*</span></Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reservation">Reservation</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bed Size */}
            <div className="space-y-2">
              <Label htmlFor="edit-bedding">Bed Size</Label>
              <Select value={beddingValue} onValueChange={setBeddingValue}>
                <SelectTrigger id="edit-bedding" className="w-full">
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Describe the room, its features, view, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. Free Wi-Fi, Ocean View"
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAmenity();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addAmenity}>
                <Plus className="size-4" />
              </Button>
            </div>

            {/* Amenity tags */}
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {amenities.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    <Sparkles className="size-3 text-muted-foreground" />
                    {item}
                    <button
                      type="button"
                      onClick={() => removeAmenity(item)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={editRoomMutation.isPending}>
              {editRoomMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
