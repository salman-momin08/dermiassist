
'use server';

/**
 * @fileOverview An AI flow to recommend doctors based on a skin condition.
 *
 * - recommendDoctors - A function that finds relevant specialists for a condition.
 * - RecommendDoctorsInput - The input type for the recommendDoctors function.
 * - RecommendDoctorsOutput - The return type for the recommendDoctors function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
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


const specializationPrompt = ai.definePrompt({
    name: 'specializationPrompt',
    input: { schema: RecommendDoctorsInputSchema },
    output: { schema: z.object({
        specialization: z.string().describe("The determined specialization."),
        recommendationReason: z.string().describe("The reason for the recommendation.")
    }) },
    prompt: `You are an intelligent medical assistant. Your task is to determine the best type of dermatologist for a patient diagnosed with '{{{conditionName}}}'.

    1.  First, determine the most appropriate specialization for this condition from the following options: General Dermatology, Cosmetic Dermatology, Pediatric Dermatology, Dermatopathology, Mohs Surgery.
    2.  If you cannot determine a clear specialization from the list for the given condition, you **MUST** default to recommending 'General Dermatology'.
    3.  Provide a brief, one-sentence reason why this specialization is the best fit for the patient's condition.
    `,
});


const recommendDoctorsFlow = ai.defineFlow(
  {
    name: 'recommendDoctorsFlow',
    inputSchema: RecommendDoctorsInputSchema,
    outputSchema: RecommendDoctorsOutputSchema,
  },
  async (input) => {
    // Step 1: Determine the best specialization and the reason.
    const { output: specializationResult } = await specializationPrompt(input);
    
    if (!specializationResult) {
        throw new Error("Could not determine a specialization.");
    }

    // Step 2: Use the determined specialization to find doctors.
    let doctors = await findDoctorsTool({
      specialization: specializationResult.specialization,
    });
    
    let finalReason = specializationResult.recommendationReason;

    // Step 3: If no doctors are found, fall back to General Dermatology.
    if (doctors.length === 0 && specializationResult.specialization !== 'General Dermatology') {
        doctors = await findDoctorsTool({
            specialization: 'General Dermatology',
        });
        finalReason = `While no specialists for ${specializationResult.specialization} were found, here are some excellent General Dermatologists who can assist with ${input.conditionName}.`;
    }

    // Step 4: Combine the results into the final output.
    return {
      doctors: doctors,
      recommendationReason: finalReason,
    };
  }
);
