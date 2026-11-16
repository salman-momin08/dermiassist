
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import type { GenerateResponseData } from 'genkit/model';
import { hfChatCompletion, HF_MODELS, getInferenceProvider, type HFChatMessage } from '@/lib/hf-client';

// Every generative Genkit call (chatbot, disease detection, proforma, report
// generation) routes to the explicitly configured open-source provider. The `googleAI`
// plugin is kept ONLY for the media flows (TTS, healing video) and RAG
// embeddings, which explicitly request a `googleAI.model(...)`.
const HF_MODEL_NAME = 'open-source/inference';
const googleConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);

export const ai = genkit({
  plugins: googleConfigured ? [googleAI()] : [],
  model: HF_MODEL_NAME,
});

/** Minimal view of a Genkit content part (text or media). */
interface LoosePart {
  text?: string;
  media?: { url?: string };
}

type HFContentPart =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'text'; text: string };

ai.defineModel(
  {
    name: HF_MODEL_NAME,
    label: getInferenceProvider() === 'groq' ? 'Groq (Direct Inference)' : 'Hugging Face (Open-Source Inference Providers)',
    supports: {
      multiturn: true,
      media: true,
      tools: false,
      systemRole: true,
      output: ['text', 'json'],
      // Let Genkit inject the output schema into the prompt and parse the JSON
      // result, so flows using `output: { schema }` keep working unchanged.
      constrained: 'none',
    },
  },
  async (request): Promise<GenerateResponseData> => {
    let hasMedia = false;

    const messages: HFChatMessage[] = request.messages.map((m) => {
      const role = m.role === 'model' ? 'assistant' : m.role;
      const parts = m.content as unknown as LoosePart[];
      const mediaParts = parts.filter((p) => p.media?.url);

      if (mediaParts.length > 0) {
        hasMedia = true;
        const content = parts.flatMap((p): HFContentPart[] => {
          if (p.media?.url) return [{ type: 'image_url', image_url: { url: p.media.url } }];
          if (p.text) return [{ type: 'text', text: p.text }];
          return [];
        });
        return { role, content } as HFChatMessage;
      }

      return { role, content: parts.map((p) => p.text ?? '').join('') } as HFChatMessage;
    });

    const wantsJson = Boolean(request.output?.schema) || request.output?.format === 'json';
    const config = (request.config ?? {}) as { temperature?: number; maxOutputTokens?: number };

    const model = hasMedia
      ? HF_MODELS.vision()
      : wantsJson
        ? HF_MODELS.reasoning()
        : HF_MODELS.chat();

    const text = await hfChatCompletion({
      model,
      messages,
      temperature: config.temperature,
      maxTokens: config.maxOutputTokens,
      json: wantsJson,
    });

    return {
      finishReason: 'stop',
      message: { role: 'model', content: [{ text }] },
    };
  }
);
