'use server';

/**
 * @fileOverview A simplified AI assistant for the DermiAssist-AI platform.
 * 
 * This assistant handles informational questions (FAQs) and navigation.
 * It does NOT process personal medical data or perform analysis directly.
 * It routes users to the appropriate pages for those actions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// //////////////////////////////////////////////////////////////////
// UNIFIED ASSISTANT FLOW
// //////////////////////////////////////////////////////////////////

const DermiAssistantInputSchema = z.object({
    userId: z.string().describe('The ID of the currently authenticated user.'),
    command: z.string().describe('The user\'s text command.'),
    conversationHistory: z.string().optional().describe('The history of the conversation so far.'),
});
export type DermiAssistantInput = z.infer<typeof DermiAssistantInputSchema>;

const DermiAssistantOutputSchema = z.object({
    action: z.enum([
        "navigate",
        "respond"
    ]).describe("The type of action: 'navigate' to a page or 'respond' with text."),
    destination: z.string().optional().describe("The simple relative URL to navigate to (e.g., '/dashboard', '/analyze')."),
    response: z.string().describe("A helpful response to the user."),
});
export type DermiAssistantOutput = z.infer<typeof DermiAssistantOutputSchema>;

export async function dermiAssistant(
    input: DermiAssistantInput
): Promise<DermiAssistantOutput> {
    return dermiAssistantFlow(input);
}

const prompt = ai.definePrompt({
    name: 'dermiAssistantPrompt',
    input: { schema: DermiAssistantInputSchema },
    output: { schema: DermiAssistantOutputSchema },
    prompt: `You are Dermi, a friendly AI assistant for DermiAssist-AI. Your scope is strictly limited to answering FAQs about the platform/dermatology and helping users navigate the website.

    **PRIVACY & SECURITY RULE:**
    - You do NOT have access to user data, medical records, or analysis tools.
    - Do NOT attempt to diagnose or analyze photos directly.
    - If a user asks to perform an analysis or view specific private data, guide them to the appropriate page.

    **Task: Determine Intent**

    **1. QUESTION (FAQ):**
    - usage: User asks about skin conditions, how the app works, troubleshooting, etc.
    - action: "respond"
    - response: concise, helpful answer based on the knowledge base below.

    **2. NAVIGATION:**
    - usage: User wants to do something (check skin, see reports, find doctor, go to profile, etc).
    - action: "navigate"
    - destination: The correct relative URL.
    - response: "Sure, taking you there..." or similar.

    **Navigation Paths:**
    - New Analysis / Check Skin -> /analyze
    - View Reports / My Analyses -> /my-analyses
    - Find Doctor / Dermatologists -> /doctors
    - Dashboard -> /dashboard
    - Profile -> /profile

    **KNOWLEDGE BASE:**
    - **App:** AI skin analysis, connects with doctors.
    - **Doctors:** Certified dermatologists available for consultation.
    - **Conditions:** Acne, Eczema, Psoriasis, Ringworm (general info only).
    - **Login:** Use email/password.

    **Input:**
    User ID: {{{userId}}}
    History: {{{conversationHistory}}}
    Command: "{{{command}}}"
    `,
});

const dermiAssistantFlow = ai.defineFlow(
    {
        name: 'dermiAssistantFlow',
        inputSchema: DermiAssistantInputSchema,
        outputSchema: DermiAssistantOutputSchema,
    },
    async (input) => {
        const result = await prompt(input);
        if (!result.output) {
            throw new Error("AI failed to generate a response.");
        }
        return result.output;
    }
);
