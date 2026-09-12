"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";

interface Props {
  field: "heroBackground" | "aboutImg1" | "aboutImg2" | "aboutImg3" | "aboutImg4";
  currentImage?: string;
  title: string;
  description: string;
  previewHeightClass?: string;
  previewAspectClass?: string;
}

export function SystemImageUploadModal({
  field,
  currentImage,
  title,
  description,
  previewHeightClass = "h-36",
  previewAspectClass,
}: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      axiosInstance.post("/system/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      successAlert(`${title} updated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["systeminfo"] });
      setOpen(false);
      setFile(null);
      setPreview(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || `Failed to upload ${title.toLowerCase()}.`;
      errorAlert(message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      errorAlert("Please select an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("field", field);
    uploadMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="relative group rounded-2xl overflow-hidden border border-border hover:border-[#D16806] transition-all duration-300 cursor-pointer bg-muted/30">
          {currentImage ? (
            <div
              className={`relative w-full ${
                previewAspectClass || previewHeightClass
              } overflow-hidden`}
            >
              <img
                src={currentImage}
                alt={title}
                className="size-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-xs font-semibold text-white px-3 py-1.5 rounded-full bg-[#D16806] shadow-md">
                  Change Photo
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center w-full ${
                previewAspectClass || previewHeightClass
              } p-4 text-muted-foreground hover:text-[#D16806] transition-colors`}
            >
              <ImageIcon className="size-7 mb-1.5 opacity-60" />
              <span className="text-xs font-semibold">Upload {title}</span>
            </div>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current / Selected image preview */}
          <div
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 transition-colors hover:border-[#D16806]/60 cursor-pointer bg-muted/10"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <div className="relative w-full">
                <img
                  src={preview}
                  alt="New preview"
                  className="w-full h-48 object-cover rounded-xl shadow-md"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : currentImage ? (
              <div className="text-center space-y-2 w-full">
                <img
                  src={currentImage}
                  alt="Current"
                  className={`w-full ${
                    previewAspectClass || "h-36"
                  } object-cover rounded-xl border border-border shadow-xs`}
                />
                <p className="text-xs text-muted-foreground">
                  Click to select a new image (JPG, PNG, WebP)
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="size-9 text-[#D16806] mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold">Click to select an image</p>
                <p className="text-xs text-muted-foreground mt-1">High-resolution JPG, PNG, or WebP</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setFile(null);
              setPreview(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            className="bg-[#D16806] hover:bg-[#B55602] text-white"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Save Image
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
