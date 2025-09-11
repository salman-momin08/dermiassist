
// This file is machine-generated - edit with care!

'use server';

/**
 * @fileOverview A chatbot flow for answering frequently asked questions (FAQs).
 * 
 * - chatbotFAQ - A function that answers user questions based on pre-defined FAQs.
 * - ChatbotFAQInput - The input type for the chatbotFAQ function.
 * - ChatbotFAQOutput - The return type for the chatbotFAQ function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatbotFAQInputSchema = z.object({
  question: z.string().describe('The user question.'),
});
export type ChatbotFAQInput = z.infer<typeof ChatbotFAQInputSchema>;

const ChatbotFAQOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question.'),
});
export type ChatbotFAQOutput = z.infer<typeof ChatbotFAQOutputSchema>;

export async function chatbotFAQ(input: ChatbotFAQInput): Promise<ChatbotFAQOutput> {
  return chatbotFAQFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatbotFAQPrompt',
  input: {schema: ChatbotFAQInputSchema},
  output: {schema: ChatbotFAQOutputSchema},
  prompt: `You are a helpful chatbot assistant for a platform called SkinWise. Your ONLY purpose is to answer questions about common skin conditions, dermatology, and how to use the SkinWise platform, Make sure to avoid hallucinations.

  Here are some frequently asked questions and their answers, which form the basis of your knowledge:
  - What are common skin conditions? Some common skin conditions include acne, eczema, psoriasis, and rosacea. Ringworm is another common one, which is a fungal infection that causes a circular rash.
  - How do I log in? You can log in to your account by clicking the 'Sign In' or 'Login' button on the homepage or in the header. You will need to enter the email and password you used to sign up.
  - How does SkinWise work? SkinWise uses AI to analyze skin conditions based on uploaded images and user input, providing a detailed report and personalized recommendations.
  - How can I find a doctor on SkinWise? You can find a list of certified doctors on the 'Find a Doctor' page and send them appointment requests.
  - What kind of reports does SkinWise provide? SkinWise provides detailed reports including analysis of your skin, and do's and don'ts for skin cure. It includes uploaded image and user details
  - Can I delete my account? Yes, you can delete your account in the profile settings under the 'delete account' button.
  - What is the cost of SkinWise? SkinWise is free to use for basic skin analysis and reports. Premium features such as doctor consultations may require a subscription.

  IMPORTANT: If a user asks a question that is NOT related to skin conditions, dermatology, or the SkinWise platform, you MUST politely decline to answer. For example, if they ask about the weather, movies, or to write a poem, you must say: "I can only answer questions related to dermatology and the SkinWise platform. How can I help you with that?" Do not answer any off-topic questions.

  Now, answer the following question based on these strict rules:
  Question: {{{question}}}`, 
});

const chatbotFAQFlow = ai.defineFlow(
  {
    name: 'chatbotFAQFlow',
    inputSchema: ChatbotFAQInputSchema,
    outputSchema: ChatbotFAQOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
