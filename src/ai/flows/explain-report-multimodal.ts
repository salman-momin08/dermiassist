
'use server';

/**
 * @fileOverview An AI flow to explain a skin analysis report in a specified language.
 * This flow now includes caching to avoid re-generating explanations.
 *
 * - explainReportMultimodal - A function that provides a translated text and audio explanation.
 * - ExplainReportMultimodalInput - The input type for the function.
 * - ExplainReportMultimodalOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'zod';
import wav from 'wav';

const ExplainReportMultimodalInputSchema = z.object({
  reportConditionName: z.string().describe('The name of the diagnosed skin condition.'),
  reportRecommendations: z.string().describe('The detailed recommendations from the report.'),
  targetLanguage: z.string().describe('The language for the explanation (e.g., Hindi, Spanish, French).'),
});
export type ExplainReportMultimodalInput = z.infer<typeof ExplainReportMultimodalInputSchema>;

const ExplainReportMultimodalOutputSchema = z.object({
  explanationText: z.string().describe('The simplified explanation of the report in the target language.'),
  audioBase64: z.string().describe("The text-to-speech audio of the explanation, as a base64 encoded string."),
});
export type ExplainReportMultimodalOutput = z.infer<typeof ExplainReportMultimodalOutputSchema>;


export async function explainReportMultimodal(
  input: ExplainReportMultimodalInput
): Promise<ExplainReportMultimodalOutput> {
  return explainReportMultimodalFlow(input);
}


// Helper to convert PCM audio buffer to WAV data URI
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const explainReportMultimodalFlow = ai.defineFlow(
  {
    name: 'explainReportMultimodalFlow',
    inputSchema: ExplainReportMultimodalInputSchema,
    outputSchema: ExplainReportMultimodalOutputSchema,
  },
  async (input) => {
    // Note: Caching logic is now handled on the client-side before calling this flow.
    // This flow is now responsible only for GENERATION.
    
    // 1. Generate the translated text explanation
    const explanationPrompt = ai.definePrompt({
        name: 'generateExplanationPrompt',
        input: { schema: ExplainReportMultimodalInputSchema },
        output: { schema: z.object({ explanationText: z.string() }) },
        prompt: `You are a helpful medical assistant. A patient has a report for a condition named "{{reportConditionName}}".
        The key recommendations are: "{{reportRecommendations}}".

        Your task is to explain this report to the patient in a simple, clear, and reassuring way in the following language: **{{targetLanguage}}**.

        Keep the explanation brief and focus on the most important points. Do not add any information that is not in the recommendations.
        Start by stating the condition name in the target language.
        `,
    });
    
    const { output: explanationOutput } = await explanationPrompt(input);
    const explanationText = explanationOutput?.explanationText;

    if (!explanationText) {
        throw new Error("Failed to generate the text explanation.");
    }
    
    // 2. Generate the TTS audio from the explanation text
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' }, // A standard voice
          },
        },
      },
      prompt: explanationText,
    });

    if (!media) {
      throw new Error('Failed to generate audio from the explanation.');
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    const wavBase64 = await toWav(audioBuffer);

    return {
      explanationText: explanationText,
      audioBase64: wavBase64,
    };
  }
);
