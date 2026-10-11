"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, X, Upload, ImageUp, Trash2, Images } from "lucide-react";

interface Props {
  room: roomInterface;
}

export function UploadImagesModal({ room }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  // Upload new images to gallery
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      axiosInstance.post("/room/images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      successAlert("Images uploaded successfully to gallery.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setFiles([]);
      setPreviews([]);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to upload images.";
      errorAlert(message);
    },
  });

  // Delete an existing image from gallery
  const deleteImageMutation = useMutation({
    mutationFn: (imageUrl: string) =>
      axiosInstance.delete("/room/images", {
        data: { roomId: room._id, imageUrl },
      }),
    onMutate: (imageUrl) => {
      setDeletingUrl(imageUrl);
    },
    onSuccess: () => {
      successAlert("Image deleted from gallery.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setDeletingUrl(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to delete image.";
      errorAlert(message);
      setDeletingUrl(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles((prev) => [...prev, ...selectedFiles]);

    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (result) setPreviews((prev) => [...prev, result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length === 0) {
      errorAlert("Please select at least one image.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    formData.append("roomId", room._id);

    uploadMutation.mutate(formData);
  };

  const existingImages = room?.images || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} title="Manage Gallery Photos">
          <ImageUp className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="size-5 text-primary" />
            Room Gallery Management
          </DialogTitle>
          <DialogDescription>
            Manage interior gallery photos for <span className="font-medium text-foreground">{room.category}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── 1. Existing Gallery Photos ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Existing Gallery Photos ({existingImages.length})
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Hover & click ✕ to delete photo
              </span>
            </div>

            {existingImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/20">
                <Images className="size-8 stroke-1 text-muted-foreground/50 mb-1" />
                <p className="text-xs">No gallery photos added yet.</p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto p-1 border rounded-lg scrollbar-thin bg-muted/10">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {existingImages.map((imageUrl, index) => {
                    const isDeleting = deletingUrl === imageUrl;
                    return (
                      <div
                        key={index}
                        className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-black/5 shadow-xs"
                      >
                        <img
                          src={imageUrl}
                          alt={`Gallery ${index + 1}`}
                          className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => deleteImageMutation.mutate(imageUrl)}
                            title="Delete photo"
                            className="flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-transform active:scale-95 shadow-md"
                          >
                            {isDeleting ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 2. Add New Photos ── */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add New Photos
            </Label>

            {/* Drop zone */}
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-7 text-muted-foreground mb-1.5" />
              <p className="text-sm font-medium">Click to select photos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Supports JPG, PNG, WebP (Select multiple files)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Selected New Previews */}
            {previews.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Selected New Photos ({previews.length})
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setFiles([]);
                      setPreviews([]);
                    }}
                  >
                    Clear all
                  </Button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-40 overflow-y-auto p-1 border rounded-lg bg-muted/10">
                  {previews.map((preview, index) => (
                    <div
                      key={index}
                      className="relative group aspect-video rounded-lg overflow-hidden border border-border shadow-xs"
                    >
                      <img
                        src={preview}
                        alt={`New Preview ${index + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive transition-colors shadow-sm"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setFiles([]);
              setPreviews([]);
            }}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={files.length === 0 || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" /> Upload {files.length > 0 ? `(${files.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
