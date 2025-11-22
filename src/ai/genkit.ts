
import { genkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI(),
    firebase(), // Add the firebase plugin
  ],
  model: 'googleai/gemini-pro', // Updated to a standard, non-preview model
  enableTracingAndMetrics: true, // Enable to see traces in the Firebase console
});
