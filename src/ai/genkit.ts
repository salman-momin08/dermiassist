
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  model: 'googleai/gemini-1.5-flash-latest',
  enableTracingAndMetrics: true, // Enable to see traces in the Firebase console
});
