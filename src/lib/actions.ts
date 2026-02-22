
"use server";

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with credentials from environment variables
// This is safe to do on the server side.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFile(formData: FormData | null, base64Data?: string, options?: { folder?: string }) {
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
      folder: options?.folder
    });

    // Return both the URL for display and the public_id for future deletion
    return { success: true, url: result.secure_url, publicId: result.public_id };

  } catch (error) {
    console.error("Upload failed", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred. This is often due to missing or invalid Cloudinary credentials in the .env file.";
    return { success: false, message: `Upload failed: ${errorMessage}` };
  }
}

import { createClient } from "@/lib/supabase/server";

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

/**
 * Validates document upload data before submission
 * This is a server action for validation only - actual DB updates happen client-side
 * to properly respect RLS policies with user authentication context
 */
export async function validateDocumentUpload(documents: Record<string, { url: string; publicId: string }>) {
  try {
    console.log('[validateDocumentUpload] Validating documents:', Object.keys(documents));

    // Required document types for role change verification
    const requiredDocs = ['medicalRegistration', 'degreeCertificate', 'governmentId'];

    // Check all required documents are present
    for (const docType of requiredDocs) {
      if (!documents[docType]) {
        return {
          success: false,
          error: 'MISSING_DOCUMENT',
          message: `Missing required document: ${docType}`
        };
      }

      // Validate document structure
      const doc = documents[docType];
      if (!doc.url || typeof doc.url !== 'string') {
        return {
          success: false,
          error: 'INVALID_URL',
          message: `Invalid URL for document: ${docType}`
        };
      }

      if (!doc.publicId || typeof doc.publicId !== 'string') {
        return {
          success: false,
          error: 'INVALID_PUBLIC_ID',
          message: `Invalid public ID for document: ${docType}`
        };
      }

      // Validate URL format (basic check for Cloudinary URLs)
      if (!doc.url.startsWith('https://res.cloudinary.com/')) {
        return {
          success: false,
          error: 'INVALID_URL_FORMAT',
          message: `Document URL does not appear to be a valid Cloudinary URL: ${docType}`
        };
      }
    }

    console.log('[validateDocumentUpload] ✓ All documents validated successfully');
    return { success: true };

  } catch (error: any) {
    console.error('[validateDocumentUpload] Validation error:', error);
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message || 'Document validation failed'
    };
  }
}

