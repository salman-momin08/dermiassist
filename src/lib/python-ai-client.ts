/**
 * @fileOverview Python AI Microservice Client.
 * Connects Next.js Server Actions to the FastAPI Python LangGraph / LangChain Multi-Agent Engine.
 * Supports automatic fallback if the Python service is offline.
 */

// Canonical env var is PYTHON_AI_SERVICE_URL; FASTAPI_SERVICE_URL is accepted
// as a fallback so this client and /api/ai/analyze can't point at different hosts.
const PYTHON_AI_SERVICE_URL =
  process.env.PYTHON_AI_SERVICE_URL ||
  process.env.FASTAPI_SERVICE_URL ||
  'http://localhost:8000';

export interface PythonLangGraphDetectResponse {
  condition_name: string;
  turn_count: number;
  error?: string | null;
}

export interface PythonLangGraphQuestionResponse {
  next_question: string;
  turn_count: number;
  error?: string | null;
}

export interface PythonLangGraphEvalResponse {
  conditionName: string;
  condition: string;
  dos: string[];
  donts: string[];
  recommendations: string;
  otherConsiderations: string;
  error?: string | null;
}

/**
 * Call Python LangGraph vision agent to detect skin condition.
 */
export async function callPythonLangGraphDetect(
  photoDataUri: string,
  timeoutMs: number = 8000
): Promise<PythonLangGraphDetectResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/v1/langgraph/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photo_data_uri: photoDataUri }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Python LangGraph Detect]: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.warn('[Python LangGraph Detect unavailable - falling back to Genkit]:', err?.message || err);
    return null;
  }
}

/**
 * Call Python LangGraph dynamic proforma agent to generate the next personalized clinical question.
 */
export async function callPythonLangGraphNextQuestion(
  conditionName: string,
  conversationHistory: string,
  timeoutMs: number = 6000
): Promise<PythonLangGraphQuestionResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/v1/langgraph/next-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        condition_name: conditionName,
        conversation_history: conversationHistory,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Python LangGraph Question]: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.warn('[Python LangGraph Question unavailable - falling back to Genkit]:', err?.message || err);
    return null;
  }
}

export interface PythonLangGraphSuggestionsResponse {
  suggestions: string[];
  error?: string | null;
}

/**
 * Call Python LangGraph clinical synthesis agent to generate full evaluation report.
 */
export async function callPythonLangGraphEvaluation(
  initialCondition: string,
  userAnswers: string,
  photoDataUri?: string,
  timeoutMs: number = 10000
): Promise<PythonLangGraphEvalResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/v1/langgraph/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initial_condition: initialCondition,
        user_answers: userAnswers,
        photo_data_uri: photoDataUri,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Python LangGraph Evaluation]: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.warn('[Python LangGraph Evaluation unavailable - falling back to Genkit]:', err?.message || err);
    return null;
  }
}

/**
 * Call Python LangGraph suggestions agent to generate 3-4 tailored response chips.
 */
export async function callPythonLangGraphSuggestions(
  question: string,
  conditionName?: string,
  conversationHistory?: string,
  timeoutMs: number = 5000
): Promise<PythonLangGraphSuggestionsResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/v1/langgraph/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        condition_name: conditionName,
        conversation_history: conversationHistory,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Python LangGraph Suggestions]: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.warn('[Python LangGraph Suggestions unavailable - falling back to Genkit]:', err?.message || err);
    return null;
  }
}

