
'use server';

/**
 * @fileOverview An AI flow to recommend doctors based on a skin condition.
 *
 * - recommendDoctors - A function that finds relevant specialists for a condition.
 * - RecommendDoctorsInput - The input type for the recommendDoctors function.
 * - RecommendDoctorsOutput - The return type for the recommendDoctors function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getVerifiedDoctorsBySpecialization } from '@/lib/data';


// //////////////////////////////////////////////////////////////////
// TOOLS
// //////////////////////////////////////////////////////////////////

const findDoctorsTool = ai.defineTool(
    {
        name: 'findDoctorsBySpecialization',
        description: 'Retrieves a list of verified doctors for a given medical specialization.',
        inputSchema: z.object({
            specialization: z.string().describe('The medical specialization to search for (e.g., General Dermatology, Cosmetic Dermatology).'),
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            name: z.string(),
            specialization: z.string(),
            location: z.string(),
            avatar: z.string(),
        })),
    },
    async ({ specialization }) => {
        return getVerifiedDoctorsBySpecialization(specialization);
    }
);


// //////////////////////////////////////////////////////////////////
// RECOMMENDATION FLOW
// //////////////////////////////////////////////////////////////////


const RecommendDoctorsInputSchema = z.object({
  conditionName: z.string().describe('The name of the diagnosed skin condition.'),
});
export type RecommendDoctorsInput = z.infer<typeof RecommendDoctorsInputSchema>;


const RecommendDoctorsOutputSchema = z.object({
    doctors: z.array(z.object({
        id: z.string(),
        name: z.string(),
        specialization: z.string(),
        location: z.string(),
        avatar: z.string(),
    })).describe('A list of recommended doctors.'),
    recommendationReason: z.string().describe("A brief explanation of why this type of specialist was recommended for the given condition.")
});
export type RecommendDoctorsOutput = z.infer<typeof RecommendDoctorsOutputSchema>;


export async function recommendDoctors(input: RecommendDoctorsInput): Promise<RecommendDoctorsOutput> {
  return recommendDoctorsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'recommendDoctorsPrompt',
    input: { schema: RecommendDoctorsInputSchema },
    output: { schema: RecommendDoctorsOutputSchema },
    tools: [findDoctorsTool],
    prompt: `You are an intelligent medical assistant. Your task is to recommend the best type of dermatologist for a patient diagnosed with '{{{conditionName}}}'.

    1.  First, determine the most appropriate specialization for this condition from the following options: General Dermatology, Cosmetic Dermatology, Pediatric Dermatology, Dermatopathology, Mohs Surgery.
    2.  Provide a brief, one-sentence reason why this specialization is the best fit.
    3.  Then, use the 'findDoctorsBySpecialization' tool to find verified doctors with that specialization.
    4.  Return the list of doctors and your reason. If no doctors are found, return an empty list but still provide the reason.
    `,
});


const recommendDoctorsFlow = ai.defineFlow(
  {
    name: 'recommendDoctorsFlow',
    inputSchema: RecommendDoctorsInputSchema,
    outputSchema: RecommendDoctorsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('The model failed to produce a recommendation.');
    }
    return output;
  }
);
