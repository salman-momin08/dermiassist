/**
 * @fileOverview Central Hugging Face Inference client for the Next.js layer.
 *
 * Single source of truth for every open-source model call made from the Genkit
 * flows. Talks to Hugging Face's OpenAI-compatible Inference Providers router
 * (`router.huggingface.co/v1`) using the one `HF_TOKEN` access token, so the
 * app no longer depends on any proprietary LLM SDK for text/vision/reasoning.
 *
 * Fails closed: every helper throws a clear error if `HF_TOKEN` is missing, the
 * provider rate-limits, or the completion is empty — callers surface the
 * failure instead of masking it with fabricated content.
 */

const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';

/** Open-source model matrix. Overridable via env; sensible defaults otherwise. */
export const HF_MODELS = {
  /** Chatbot / general text generation. */
  chat: () => process.env.HF_CHAT_MODEL || 'meta-llama/Llama-3.2-3B-Instruct',
  /** Structured JSON / reasoning / report synthesis. */
  reasoning: () => process.env.HF_REASONING_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
  /** Vision / multimodal image analysis. */
  vision: () => process.env.HF_VISION_MODEL || 'Qwen/Qwen2.5-VL-3B-Instruct',
};

export type HFChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface HFChatMessage {
  role: HFChatRole;
  content: string | Array<Record<string, unknown>>;
}

export interface HFChatOptions {
  model: string;
  messages: HFChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Request strict JSON output where the provider supports it. */
  json?: boolean;
}

/** The single access token used for every Hugging Face inference call. */
export function getHfToken(): string {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
}

export function isHfConfigured(): boolean {
  return getHfToken().length > 0;
}

/**
 * Run an open-source chat completion and return the raw assistant text.
 * Throws on missing token, provider error, or empty output.
 */
export async function hfChatCompletion(opts: HFChatOptions): Promise<string> {
  const token = getHfToken();
  if (!token) {
    throw new Error('HF_TOKEN is not configured; cannot run Hugging Face inference.');
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(HF_ROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Hugging Face inference failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => (part as { text?: string })?.text ?? '').join('')
        : '';

  if (!text.trim()) {
    throw new Error('Hugging Face returned an empty completion');
  }
  return text;
}
