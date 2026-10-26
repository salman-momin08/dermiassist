import { z } from 'zod';

export const AnalysisRequestSchema = z.object({
    symptoms: z.string().trim().min(1).max(12000),
    imageUrl: z.string().max(8_000_000).refine(
        value => /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)
            || /^https:\/\/res\.cloudinary\.com\//.test(value),
        'Provide a supported image data URI or Cloudinary HTTPS URL.'
    ).optional(),
    bodyLocation: z.string().trim().max(200).optional(),
    durationDays: z.number().int().min(0).max(36500).optional(),
    // Accepted for backward compatibility; the engine routes every value to the
    // open-source Hugging Face models.
    provider: z.enum(['huggingface', 'gemini', 'openai']).optional(),
});
