
'use server';

/**
 * @fileOverview A unified AI assistant for the DermiAssist-AI platform.
 * 
 * This assistant can handle both informational questions (FAQs) and actionable commands.
 * It determines the user's intent and uses the appropriate tools or knowledge
 * to provide a helpful response or perform an action.
 * 
 * - dermiAssistant - The main function that processes user input.
 * - DermiAssistantInput - The input type for the assistant.
 * - DermiAssistantOutput - The return type for the assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAnalysesForUser } from '@/lib/data';
import { detectDiseaseName }from '@/ai/flows/detect-disease-name';

// //////////////////////////////////////////////////////////////////
// TOOLS
// //////////////////////////////////////////////////////////////////

const listAnalysesTool = ai.defineTool(
    {
        name: 'listAnalyses',
        description: 'Get a list of all of the user\'s past skin analysis reports.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user.'),
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            conditionName: z.string(),
            date: z.string(),
        })),
    },
    async ({ userId }) => {
        const analyses = await getAnalysesForUser(userId);
        return analyses;
    }
);

const startAnalysisTool = ai.defineTool(
    {
        name: 'startAnalysis',
        description: 'Starts the skin analysis process by taking an image from the user. Use this tool if the user asks to start an analysis and provides a photo.',
        inputSchema: z.object({
            photoDataUri: z.string().describe("A photo of the skin, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
        }),
        outputSchema: z.object({
            conditionName: z.string(),
        }),
    },
    async ({ photoDataUri }) => {
        const result = await detectDiseaseName({ photoDataUri });
        return result;
    }
)

// //////////////////////////////////////////////////////////////////
// UNIFIED ASSISTANT FLOW
// //////////////////////////////////////////////////////////////////

const DermiAssistantInputSchema = z.object({
    userId: z.string().describe('The ID of the currently authenticated user.'),
    command: z.string().describe('The user\'s voice or text command.'),
    conversationHistory: z.string().optional().describe('The history of the conversation so far, with "Assistant:" and "User:" prefixes.'),
    photoDataUri: z.string().optional().describe("A photo of the skin provided by the user, as a data URI. This will only be present if the agent has specifically asked for an image."),
});
export type DermiAssistantInput = z.infer<typeof DermiAssistantInputSchema>;

const DermiAssistantOutputSchema = z.object({
    action: z.enum([
        "navigate",
        "showAnalyses",
        "startProforma",
        "awaiting_photo",
        "unsupported",
        "respond" // A simple text response for questions
    ]).describe("The type of action the assistant should perform or is expecting."),
    destination: z.string().optional().describe("The URL to navigate to, if the action is 'navigate' or 'startProforma'."),
    data: z.any().optional().describe("The data to display, if the action requires showing data (like a list of analyses)."),
    response: z.string().describe("A conversational response to the user explaining what the assistant is doing, asking for more information, or answering a question."),
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
    tools: [listAnalysesTool, startAnalysisTool],
    prompt: `You are Dermi, a friendly, conversational, and unified AI assistant for the DermiAssist-AI platform. Your goal is to help users by either answering their questions or performing actions on their behalf.

    **Your Core Task: Intent Recognition**
    First, analyze the user's command to determine their intent. Are they asking a question, or are they trying to do something?

    **1. If the user is asking a QUESTION:**
    - Use your built-in knowledge base (provided below) to answer.
    - Your action should be \`respond\`.
    - Provide a helpful, concise answer in the \`response\` field.
    - Use the conversation history for context, especially for follow-up questions.
    
    **2. If the user is giving a COMMAND to perform an action:**
    - Determine the correct action and use your tools if necessary.
    - Always provide a friendly, conversational \`response\` to the user explaining what you are doing.

    **Supported Actions & Commands:**
    - **Navigation:** If the user wants to go to a page (e.g., "go to my dashboard", "take me to the doctor page"), set \`action\` to "navigate" and \`destination\` to the correct URL (e.g., "/dashboard", "/doctors").
    - **List Reports:** If the user asks to see their reports ("show my reports", "list my analyses"), use the \`listAnalyses\` tool. Then, set \`action\` to "showAnalyses" and put the tool's output in the \`data\` field.
    - **View Specific Report:** If the user asks to see a specific report (e.g., "open my psoriasis report"), first use the \`listAnalyses\` tool to find the report ID, then navigate to \`/my-analyses/{id}\`.
    - **Start New Analysis:**
        - If the command is "start a new analysis" or "check my skin" and **no photo is provided**, you MUST ask for one. Set \`action\` to "awaiting_photo" and \`response\` to "Of course. Please provide a clear photo of the skin area you want to analyze."
        - If a photo is provided (either with the initial command or after you ask for it), use the \`startAnalysisTool\`.
        - After the tool returns a condition name, set \`action\` to "startProforma". Your \`response\` must be "Analysis started! I've identified it as possibly being **{conditionName}**. I'm now taking you to the next step where I'll ask a few more questions." The final destination URL will be constructed by the system.
    - **Unsupported:** If you cannot understand the command or it's outside your scope, set \`action\` to "unsupported" and respond politely.

    ---
    **KNOWLEDGE BASE FOR ANSWERING QUESTIONS**

    **Platform FAQs:**
    - **How does DermiAssist-AI work?** Our platform uses AI to analyze skin conditions from uploaded images and user-provided information. It generates a detailed report with personalized recommendations.
    - **How can I find a doctor?** Navigate to the 'Find a Doctor' page to see a list of certified dermatologists and send them appointment requests.
    - **Can I delete my account?** Yes, from your profile page, accessible from the user menu in the header.
    
    **Dermatology FAQs:**
    - **Acne:** A common condition where hair follicles get clogged with oil and dead skin cells. Prevention includes keeping your face clean and using oil-free moisturizers.
    - **Eczema (Atopic Dermatitis):** A condition causing red, itchy skin. It's chronic and flares up. Prevention involves regular moisturizing and avoiding triggers.
    - **Psoriasis:** A disease causing red, itchy, scaly patches. It's chronic but manageable.
    - **Ringworm:** A common fungal infection (not a worm!) causing a circular, itchy rash.

    **Troubleshooting FAQs:**
    - **Login Error:** Double-check your email and password. Use the "Forgot Password?" link if needed.
    - **Report Generation Error:** Try again with a clear, well-lit photo. If it persists, try again later.

    **Rules:**
    - **Off-Topic:** If asked about something unrelated to dermatology or the platform (e.g., weather, movies), politely decline with: "I can only answer questions related to dermatology and the DermiAssist-AI platform. How can I help you with that?"
    - **Security:** NEVER ask for or repeat personal information like passwords.
    ---

    **CURRENT TASK**

    **User Information:**
    - User ID: {{{userId}}}

    **Conversation History:**
    {{{conversationHistory}}}

    **User's Latest Command:**
    "{{{command}}}"
    
    {{#if photoDataUri}}
    **Attached Photo:**
    A photo has been provided. Use it with the 'startAnalysisTool' if the user's command is to start an analysis.
    {{/if}}

    Now, determine the intent and respond.
    `,
});

const dermiAssistantFlow = ai.defineFlow(
  {
    name: 'dermiAssistantFlow',
    inputSchema: DermiAssistantInputSchema,
    outputSchema: DermiAssistantOutputSchema,
  },
  async (input) => {
    // The prompt will determine if a tool needs to be called
    const modelResponse = await prompt(input);

    // If no tool is requested, just return the model's output
    if (!modelResponse.toolRequest) {
        if (!modelResponse.output) throw new Error("Assistant failed to return an output.");
        return modelResponse.output;
    }
    
    // Execute the requested tool
    let toolResult;
    if (modelResponse.toolRequest.name === 'listAnalyses') {
        toolResult = await listAnalysesTool(modelResponse.toolRequest.input);
    } else if (modelResponse.toolRequest.name === 'startAnalysis') {
        toolResult = await startAnalysisTool(modelResponse.toolRequest.input);
    } else {
        throw new Error(`Unsupported tool: ${modelResponse.toolRequest.name}`);
    }

    // Send the tool's result back to the model to get the final response
    const finalResponse = await prompt(input, { toolResult });

    if (!finalResponse.output) {
      throw new Error('The assistant failed to produce a final output after tool execution.');
    }
    
    const output = finalResponse.output;

    // Post-processing: If starting a proforma, construct the final destination URL
    if (output.action === 'startProforma' && toolResult && 'conditionName' in toolResult && input.photoDataUri) {
        output.destination = `/analyze?condition=${encodeURIComponent(toolResult.conditionName)}&image=${encodeURIComponent(input.photoDataUri)}`;
        output.response = `Analysis started! I've identified it as possibly being **${toolResult.conditionName}**. I'm now taking you to the next step where I'll ask a few more questions.`;
    }
    
    return output;
  }
);
