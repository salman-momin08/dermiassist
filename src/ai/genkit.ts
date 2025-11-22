import { genkit, type Plugin } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';
import { defineDotprompt } from 'genkit/dotprompt';
import { core } from '@genkit-ai/core';

export const ai = genkit({
  plugins: [
    googleAI(),
    firebase(), // Add the firebase plugin
    core(),
  ],
  model: 'googleai/gemini-pro', // Updated to a standard, non-preview model
  enableTracingAndMetrics: true, // Enable to see traces in the Firebase console
});
