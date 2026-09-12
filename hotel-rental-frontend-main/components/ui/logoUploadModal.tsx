"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
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
import { Loader2, Upload, X } from "lucide-react";

interface Props {
  currentLogo: string;
}

export function LogoUploadModal({ currentLogo }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      axiosInstance.post("/system/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      successAlert("Logo uploaded successfully.");
      queryClient.invalidateQueries({ queryKey: ["systeminfo"] });
      setOpen(false);
      setFile(null);
      setPreview(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to upload logo.";
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
      errorAlert("Please select a logo image.");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    uploadMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative group rounded-xl overflow-hidden border-2 border-border hover:border-primary/50 transition-all duration-200 cursor-pointer"
        >
          {currentLogo ? (
            <>
              <img
                src={currentLogo}
                alt="Current logo"
                className="h-28 w-auto object-contain p-2"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-xs font-medium text-white">Click to change</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 w-40 p-4 text-muted-foreground">
              <Upload className="size-6 mb-1" />
              <span className="text-xs font-medium">Add Logo</span>
            </div>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Upload Logo</DialogTitle>
          <DialogDescription>
            Upload a new logo image for your business. It will appear on the landing page and receipts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current logo preview */}
          {currentLogo && !preview && (
            <div className="flex justify-center">
              <div className="rounded-lg border border-border p-4 bg-muted/30">
                <img
                  src={currentLogo}
                  alt="Current logo"
                  className="h-20 w-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-muted-foreground/50 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <div className="relative w-full">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-40 object-contain rounded-md"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to select a logo</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP</p>
              </>
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
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Upload Logo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
