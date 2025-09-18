
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
        return getAnalysesForUser(userId);
    }
);

// //////////////////////////////////////////////////////////////////
// AGENT FLOW
// //////////////////////////////////////////////////////////////////

const PatientAgentInputSchema = z.object({
    userId: z.string().describe('The ID of the currently authenticated user.'),
    command: z.string().describe('The user\'s voice or text command.'),
});
export type PatientAgentInput = z.infer<typeof PatientAgentInputSchema>;

// The agent's output can be a navigation action or a list of data
const PatientAgentOutputSchema = z.object({
    action: z.enum([
        "navigate",
        "showAnalyses",
        "unsupported"
    ]).describe("The type of action the agent should perform."),
    destination: z.string().optional().describe("The URL to navigate to, if the action is 'navigate'."),
    data: z.any().optional().describe("The data to display, if the action requires showing data."),
    response: z.string().describe("A conversational response to the user explaining what the agent is doing."),
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
    tools: [listAnalysesTool],
    prompt: `You are a helpful patient assistant for the DermiAssist-AI platform. Your goal is to help users navigate the app and perform tasks based on their commands.

    **Your Capabilities:**
    - You can navigate to any page: Dashboard, New Analysis, My Analyses, Find a Doctor, Appointments, Chat.
    - You can retrieve a list of past analysis reports for the user.
    - You can navigate to a specific analysis report if the user asks for it (e.g., "show me my last report", "open the acne report").

    **IMPORTANT RULES:**
    1.  **Determine the Action:** Based on the user's command, decide what to do.
        - If they want to go to a page, set \`action\` to "navigate" and \`destination\` to the correct URL (e.g., "/dashboard", "/analyze").
        - If they ask to see their reports ("show my reports", "list my analyses"), use the \`listAnalyses\` tool. Then, set \`action\` to "showAnalyses" and put the tool's output in the \`data\` field.
        - If the user asks to see a specific report, first use the \`listAnalyses\` tool to get the available reports. Then, find the correct report ID from the list and set the \`action\` to "navigate" and the \`destination\` to \`/my-analyses/{id}\`.
        - If the command is unclear or you don't support it (like "change my password" or "what's the weather"), set \`action\` to "unsupported".
    2.  **Generate a Response:** Always provide a friendly, conversational \`response\` telling the user what you are doing (e.g., "Sure, taking you to the New Analysis page.", "Here are your latest analysis reports.").

    **User Information:**
    - User ID: {{{userId}}}

    **User's Command:**
    "{{{command}}}"
    `,
});

const patientAgentFlow = ai.defineFlow(
  {
    name: 'patientAgentFlow',
    inputSchema: PatientAgentInputSchema,
    outputSchema: PatientAgentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('The agent failed to produce an output.');
    }
    return output;
  }
);
