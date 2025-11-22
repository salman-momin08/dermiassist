
'use server';

/**
 * @fileOverview A flow for generating a video that visualizes skin healing progress.
 *
 * - generateHealingVideo - A function that creates a video transitioning between two photos.
 * - GenerateHealingVideoInput - The input type for the generateHealingVideo functionूं।
 * - GenerateHealingVideoOutput - The return type for the generateHealingVideo function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const GenerateHealingVideoInputSchema = z.object({
  originalPhotoDataUri: z
    .string()
    .describe(
      "The original photo of the skin condition, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  newPhotoDataUri: z
    .string()
    .describe(
      "The new photo of the skin condition for comparison, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateHealingVideoInput = z.infer<typeof GenerateHealingVideoInputSchema>;

const GenerateHealingVideoOutputSchema = z.object({
    videoDataUri: z.string().describe("The generated video as a data URI.")
});
export type GenerateHealingVideoOutput = z.infer<typeof GenerateHealingVideoOutputSchema>;


export async function generateHealingVideo(input: GenerateHealingVideoInput): Promise<GenerateHealingVideoOutput> {
    return generateHealingVideoFlow(input);
}


const generateHealingVideoFlow = ai.defineFlow(
  {
    name: 'generateHealingVideoFlow',
    inputSchema: GenerateHealingVideoInputSchema,
    outputSchema: GenerateHealingVideoOutputSchema,
  },
  async (input) => {
    let { operation } = await ai.generate({
      model: googleAI.model('veo-3.0-generate-preview'),
      prompt: [
        {
          media: {
            url: input.originalPhotoDataUri,
          },
        },
        {
          media: {
            url: input.newPhotoDataUri
          }
        },
        {
          text: 'Create a short video that smoothly transitions from the first image to the second image, visualizing a healing effect on the skin condition shown.',
        },
      ],
      config: {
        aspectRatio: '16:9',
      },
    });

    if (!operation) {
        throw new Error('Expected the model to return an operation');
    }

    // Wait until the operation completes.
    while (!operation.done) {
        operation = await ai.checkOperation(operation);
        // Sleep for 5 seconds before checking again.
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    
    if (operation.error) {
        throw new Error('failed to generate video: ' + operation.error.message);
    }
    
    const video = operation.output?.message?.content.find((p) => !!p.media);
    if (!video || !video.media) {
        throw new Error('Failed to find the generated video');
    }

    // Veo returns a URL, we need to fetch it and convert to a data URI for the client
    const fetch = (await import('node-fetch')).default;
    const videoDownloadResponse = await fetch(
        `${video.media.url}&key=${process.env.GEMINI_API_KEY}`
    );

    if (!videoDownloadResponse.ok || !videoDownloadResponse.body) {
        throw new Error(`Failed to download video: ${videoDownloadResponse.statusText}`);
    }

    const buffer = await videoDownloadResponse.arrayBuffer();
    const videoDataUri = `data:video/mp4;base64,${Buffer.from(buffer).toString('base64')}`;
    
    return { videoDataUri };
  }
);
