import cloudinary from "./cloudinary";
import fs from "fs";

export const uploadToCloudinary = async (filePath: string, folder: string = "rooms"): Promise<string> => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
  });
  // Clean up local file after successful upload
  fs.unlink(filePath, (err) => {
    if (err) console.error("Failed to delete local file:", err);
  });
  return result.secure_url;
};

export const uploadMultipleToCloudinary = async (filePaths: string[], folder: string = "rooms"): Promise<string[]> => {
  const uploadPromises = filePaths.map((filePath) => uploadToCloudinary(filePath, folder));
  return Promise.all(uploadPromises);
};
