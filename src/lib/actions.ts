
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

  try {
    // Convert file to buffer and then to a Base64 data URI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Upload the data URI to Cloudinary with AI cropping
    const result = await cloudinary.uploader.upload(dataUri, {
      gravity: "face",
      crop: "thumb",
      width: 400,
      height: 400,
      zoom: "0.8"
    });
    
    // Return both the URL for display and the public_id for future deletion
    return { success: true, url: result.secure_url, publicId: result.public_id };

  } catch (error) {
    console.error("Upload failed", error);
    // It's helpful to return a more specific error message if possible
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Upload failed: ${errorMessage}` };
  }
}

export async function deleteFile(publicId: string) {
    if (!publicId) {
        return { success: false, message: 'No public ID provided.' };
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'ok') {
            return { success: true, message: 'File deleted successfully.' };
        } else {
            return { success: false, message: result.result };
        }
    } catch (error) {
        console.error("Deletion failed", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `Deletion failed: ${errorMessage}` };
    }
}
