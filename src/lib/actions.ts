"use server";

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with credentials from environment variables
// This is safe to do on the server side.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, message: "No file provided." };
  }

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  try {
    const results = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({
          // Optionally, you can add upload presets, tags, etc. here
      }, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }).end(buffer);
    });

    return { success: true, url: (results as any).secure_url };
  } catch (error) {
    console.error("Upload failed", error);
    return { success: false, message: "Upload failed." };
  }
}
