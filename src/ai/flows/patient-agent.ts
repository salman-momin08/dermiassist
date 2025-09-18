
'use server';

/**
 * @fileOverview A patient agent that can perform tasks on behalf of the user.
 * 
 * - patientAgent - A function that interprets a user's command and uses tools to act.
 * - PatientAgentInput - The input type for the patientAgent function.
 * - PatientAgentOutput - The return type for the patientAgent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
        description: 'Starts the skin analysis process by taking an image from the user.',
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
// AGENT FLOW
// //////////////////////////////////////////////////////////////////

const PatientAgentInputSchema = z.object({
    userId: z.string().describe('The ID of the currently authenticated user.'),
    command: z.string().describe('The user\'s voice or text command.'),
    conversationHistory: z.string().optional().describe('The history of the conversation so far, with "Agent:" and "User:" prefixes.'),
    photoDataUri: z.string().optional().describe("A photo of the skin provided by the user, as a data URI. This will only be present if the agent has specifically asked for an image."),
});
export type PatientAgentInput = z.infer<typeof PatientAgentInputSchema>;

// The agent's output can be a navigation action or a list of data
const PatientAgentOutputSchema = z.object({
    action: z.enum([
        "navigate",
        "showAnalyses",
        "startProforma",
        "awaiting_photo",
        "unsupported",
        "respond" // A simple text response
    ]).describe("The type of action the agent should perform or is expecting."),
    destination: z.string().optional().describe("The URL to navigate to, if the action is 'navigate' or 'startProforma'."),
    data: z.any().optional().describe("The data to display, if the action requires showing data."),
    response: z.string().describe("A conversational response to the user explaining what the agent is doing or asking for."),
});
export type PatientAgentOutput = z.infer<typeof PatientAgentOutputSchema>;

export async function patientAgent(
    input: PatientAgentInput
): Promise<PatientAgentOutput> {
  return patientAgentFlow(input);
}


const prompt = ai.definePrompt({
    name: 'patientAgentPrompt',
    input: { schema: PatientAgentInputSchema },
    output: { schema: PatientAgentOutputSchema },
    tools: [listAnalysesTool, startAnalysisTool],
    prompt: `You are a helpful and conversational patient assistant for the DermiAssist-AI platform. Your goal is to help users navigate the app and perform tasks based on their commands.

    **Your Capabilities:**
    - You can navigate to any page: Dashboard, New Analysis, My Analyses, Find a Doctor, Appointments, Chat, Profile.
    - You can retrieve a list of past analysis reports for the user.
    - You can navigate to a specific analysis report if the user asks for it (e.g., "show me my last report", "open the acne report").
    - You can start a new skin analysis.

    **Conversation Flow & Rules:**
    1.  **Analyze User Command:** Determine the user's intent from their command.
    2.  **Navigation:** If the user wants to go to a page, set \`action\` to "navigate" and \`destination\` to the correct URL (e.g., "/dashboard", "/doctors"). Respond with something like "Taking you to the Find a Doctor page."
    3.  **List Reports:** If the user asks to see their reports ("show my reports", "list my analyses"), use the \`listAnalyses\` tool. Then, set \`action\` to "showAnalyses" and put the tool's output in the \`data\` field. Respond with "Here are your latest analysis reports."
    4.  **View Specific Report:** If the user asks to see a specific report (e.g., "open my psoriasis report"), first use the \`listAnalyses\` tool to find the correct report ID. Then, set \`action\` to "navigate" and the \`destination\` to \`/my-analyses/{id}\`.
    5.  **Start New Analysis:**
        - If the user says "start a new analysis" or "check my skin," and **no photo is provided** in the input, you MUST ask them for one. Set the \`action\` to "awaiting_photo" and the \`response\` to "Of course. Please provide a clear photo of the skin area you want to analyze."
        - If the user provides a command and a photo at the same time, or if they provide a photo after you've asked for one, use the \`startAnalysisTool\` with the photo.
        - After the \`startAnalysisTool\` returns the initial condition name, set the \`action\` to "startProforma", the \`destination\` to \`/analyze?condition={conditionName}&image={photoDataUri}\`, and the \`response\` to "Analysis started! I've identified it as {conditionName}. I'm taking you to the next step to answer a few questions."
    6.  **Unsupported Commands:** If the command is unclear or you don't support it (like "change my password" or "what's the weather"), set \`action\` to "unsupported" and respond politely explaining your limitations.
    7.  **General Conversation:** If the user is just chatting, set the \`action\` to "respond" and provide a friendly, helpful reply.
    8.  **Use History:** Pay attention to the conversation history to understand context.

    **IMPORTANT:** Always provide a friendly, conversational \`response\` to the user for every action.

    **User Information:**
    - User ID: {{{userId}}}

    **Conversation History:**
    {{{conversationHistory}}}

    **User's Latest Command:**
    "{{{command}}}"
    
    {{#if photoDataUri}}
    **Attached Photo:**
    A photo has been provided by the user. Use it with the 'startAnalysisTool' if the command is to start an analysis.
    {{/if}}
    `,
});

const patientAgentFlow = ai.defineFlow(
  {
    name: 'patientAgentFlow',
    inputSchema: PatientAgentInputSchema,
    outputSchema: PatientAgentOutputSchema,
  },
  async (input) => {
    const modelResponse = await prompt(input);

    if (!modelResponse.output) {
      throw new Error('The agent failed to produce an output.');
    }
    
    const output = modelResponse.output;

    if (modelResponse.toolRequest?.name === 'listAnalyses') {
      const toolResponse = await listAnalysesTool(modelResponse.toolRequest.input);
      output.data = toolResponse;
    } else if (modelResponse.toolRequest?.name === 'startAnalysis') {
      const toolResponse = await startAnalysisTool(modelResponse.toolRequest.input);
      output.data = toolResponse;
    }
    
     // If the tool returns a destination, we need to pass the photo through if it exists.
    if (output.action === 'startProforma' && output.destination && input.photoDataUri) {
        output.destination = `/analyze?condition=${encodeURIComponent(output.data.conditionName)}&image=${encodeURIComponent(input.photoDataUri)}`;
        output.response = `Analysis started! I've identified it as possibly being **${output.data.conditionName}**. I'm now taking you to the next step where I'll ask a few more questions.`;
    }
    
    return output;
  }
);
    
