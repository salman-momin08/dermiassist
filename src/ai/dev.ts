import { config } from 'dotenv';
config();

import '@/ai/flows/chatbot-faq.ts';
import '@/ai/flows/generate-ai-report-summary.ts';
import '@/ai/flows/skin-condition-analysis.ts';
import '@/ai/flows/visual-progress-analysis.ts';
import '@/ai/flows/generate-healing-video.ts';
import '@/ai/flows/generate-case-file-summary.ts';
import '@/ai/flows/generate-chat-reply.ts';
import '@/ai/flows/generate-chat-summary.ts';
import '@/ai/flows/generate-100ms-token.ts';
