
"use server";

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with credentials from environment variables
// This is safe to do on the server side.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFile(formData: FormData | null, base64Data?: string) {
  let dataUri: string;
  
  if (base64Data) {
    // Handling base64 encoded audio
    dataUri = `data:audio/wav;base64,${base64Data}`;
  } else if (formData) {
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, message: "No file provided in FormData." };
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;
  } else {
     return { success: false, message: "No file or data provided." };
  }


  try {
    // Upload the data URI to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: "auto", 
    });
    
    // Return both the URL for display and the public_id for future deletion
    return { success: true, url: result.secure_url, publicId: result.public_id };

  } catch (error) {
    console.error("Upload failed", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred. This is often due to missing or invalid Cloudinary credentials in the .env file.";
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
