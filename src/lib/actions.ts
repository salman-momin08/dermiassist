"use server";

/**
 * @fileOverview Server actions for file management with Cloudinary.
 *
 * All file operations run server-side only, with explicit input validation
 * and structured error handling. No secrets are ever exposed to the client.
 */

import { v2 as cloudinary } from 'cloudinary';
import { logger } from '@/lib/logger';
import { FileUploadError, serializeError } from '@/lib/errors';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// Validate required env vars at module load time (server startup)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY    = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    logger.warn('cloudinary.config.missing', {
        hasCloudName: !!CLOUDINARY_CLOUD_NAME,
        hasApiKey:    !!CLOUDINARY_API_KEY,
        hasApiSecret: !!CLOUDINARY_API_SECRET,
    });
}

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key:    CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
});

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Maximum allowed file size (10 MB). Enforced server-side. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed image MIME types. Checked against the file's actual MIME type. */
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
]);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UploadResult {
    success: true;
    url: string;
    publicId: string;
    message?: string;
}

export interface UploadError {
    success: false;
    message: string;
    code?: string;
}

export type UploadFileResult = UploadResult | UploadError;

export interface DeleteResult {
    success: boolean;
    message: string;
}

export interface DocumentRecord {
    url: string;
    publicId: string;
}

export interface ValidateDocumentsResult {
    success: boolean;
    error?: string;
    message?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validates that a File object passes size and MIME type checks.
 * Raises FileUploadError if validation fails.
 */
function validateFile(file: File): void {
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new FileUploadError(
            `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
            { fileSizeBytes: file.size, maxBytes: MAX_FILE_SIZE_BYTES }
        );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new FileUploadError(
            `Unsupported file type: ${file.type}. Allowed types: JPEG, PNG, WebP, GIF, BMP.`,
            { fileType: file.type }
        );
    }
}

// ─────────────────────────────────────────────────────────────
// Public Server Actions
// ─────────────────────────────────────────────────────────────

/**
 * Upload a file to Cloudinary.
 *
 * Accepts either a FormData object (image uploads from the UI)
 * or a raw base64 string (audio/TTS uploads from server flows).
 */
export async function uploadFile(
    formData: FormData | null,
    base64Data?: string,
    options?: { folder?: string }
): Promise<UploadFileResult> {
    let dataUri: string;

    if (base64Data) {
        // Server-generated audio — no user-supplied MIME type to validate
        dataUri = `data:audio/wav;base64,${base64Data}`;
    } else if (formData) {
        const file = formData.get('file') as File | null;
        if (!file) {
            return { success: false, message: 'No file provided in FormData.', code: 'NO_FILE' };
        }

        // Server-side validation — does NOT rely on browser `accept` attribute
        try {
            validateFile(file);
        } catch (err) {
            const e = err as FileUploadError;
            return { success: false, message: e.message, code: e.code };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        dataUri = `data:${file.type};base64,${buffer.toString('base64')}`;
    } else {
        return { success: false, message: 'No file or data provided.', code: 'NO_INPUT' };
    }

    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            resource_type: 'auto',
            folder: options?.folder,
        });

        logger.info('cloudinary.upload.success', {
            publicId: result.public_id,
            folder: options?.folder,
            bytes: result.bytes,
        });

        return { success: true, url: result.secure_url, publicId: result.public_id };

    } catch (err: unknown) {
        logger.error('cloudinary.upload.failed', {
            folder: options?.folder,
            error: err instanceof Error ? err.message : String(err),
        });
        const message = err instanceof Error ? err.message : 'Upload failed due to an unknown error.';
        return { success: false, message: `Upload failed: ${message}`, code: 'UPLOAD_ERROR' };
    }
}

/**
 * Delete a file from Cloudinary by its public ID.
 */
export async function deleteFile(publicId: string): Promise<DeleteResult> {
    if (!publicId || typeof publicId !== 'string') {
        return { success: false, message: 'A valid public ID is required.' };
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result === 'ok') {
            logger.info('cloudinary.delete.success', { publicId });
            return { success: true, message: 'File deleted successfully.' };
        }

        logger.warn('cloudinary.delete.unexpected_result', { publicId, result: result.result });
        return { success: false, message: `Unexpected result from Cloudinary: ${result.result}` };

    } catch (err: unknown) {
        logger.error('cloudinary.delete.failed', {
            publicId,
            error: err instanceof Error ? err.message : String(err),
        });
        const message = err instanceof Error ? err.message : 'Deletion failed due to an unknown error.';
        return { success: false, message: `Deletion failed: ${message}` };
    }
}

/**
 * Validates that all required documents are present and well-formed
 * before a role-change request is submitted.
 *
 * This is a server action for validation only — actual DB updates happen
 * client-side to correctly respect RLS policies with user auth context.
 */
export async function validateDocumentUpload(
    documents: Record<string, DocumentRecord>
): Promise<ValidateDocumentsResult> {
    const REQUIRED_DOCS = ['medicalRegistration', 'degreeCertificate', 'governmentId'] as const;
    const CLOUDINARY_URL_PREFIX = 'https://res.cloudinary.com/';

    try {
        for (const docType of REQUIRED_DOCS) {
            const doc = documents[docType];

            if (!doc) {
                return { success: false, error: 'MISSING_DOCUMENT', message: `Missing required document: ${docType}` };
            }

            if (!doc.url || typeof doc.url !== 'string') {
                return { success: false, error: 'INVALID_URL', message: `Invalid URL for document: ${docType}` };
            }

            if (!doc.publicId || typeof doc.publicId !== 'string') {
                return { success: false, error: 'INVALID_PUBLIC_ID', message: `Invalid public ID for document: ${docType}` };
            }

            if (!doc.url.startsWith(CLOUDINARY_URL_PREFIX)) {
                return {
                    success: false,
                    error: 'INVALID_URL_FORMAT',
                    message: `Document URL must be a Cloudinary URL for: ${docType}`,
                };
            }
        }

        logger.info('document_upload.validated', { documentTypes: Object.keys(documents) });
        return { success: true };

    } catch (err: unknown) {
        logger.error('document_upload.validation_error', {
            error: err instanceof Error ? err.message : String(err),
        });
        const serialized = serializeError(err);
        return { success: false, error: 'VALIDATION_ERROR', message: serialized.error };
    }
}
