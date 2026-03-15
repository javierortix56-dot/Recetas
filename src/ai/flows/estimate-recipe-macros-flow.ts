'use server';
/**
 * @fileOverview A Genkit flow for estimating nutritional macros of a recipe based on its ingredients.
 *
 * - estimateRecipeMacros - A function that handles the macro estimation process.
 * - EstimateRecipeMacrosInput - The input type for the estimateRecipeMacros function.
 * - EstimateRecipeMacrosOutput - The return type for the estimateRecipeMacros function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EstimateRecipeMacrosInputSchema = z.object({
  recipeName: z.string().describe('The name of the recipe.'),
  ingredients: z.array(z.string()).describe('A list of ingredients for the recipe, e.g., "2 large eggs", "1 cup all-purpose flour".'),
  portions: z.number().optional().describe('The number of servings the recipe yields. If provided, macros per serving will also be calculated.'),
});
export type EstimateRecipeMacrosInput = z.infer<typeof EstimateRecipeMacrosInputSchema>;

const EstimateRecipeMacrosOutputSchema = z.object({
  totalMacros: z.object({
    proteins: z.number().describe('Total proteins in grams for the entire recipe.'),
    carbohydrates: z.number().describe('Total carbohydrates in grams for the entire recipe.'),
    fat: z.number().describe('Total fat in grams for the entire recipe.'),
  }).describe('Total macronutrients for the entire recipe.'),
  perServingMacros: z.object({
    proteins: z.number().describe('Proteins in grams per serving.'),
    carbohydrates: z.number().describe('Carbohydrates in grams per serving.'),
    fat: z.number().describe('Fat in grams per serving.'),
  }).optional().describe('Macronutrients per serving, if portions were provided.'),
  notes: z.string().optional().describe('Any notes or disclaimers from the AI regarding the macro estimation.'),
});
export type EstimateRecipeMacrosOutput = z.infer<typeof EstimateRecipeMacrosOutputSchema>;

export async function estimateRecipeMacros(input: EstimateRecipeMacrosInput): Promise<EstimateRecipeMacrosOutput> {
  return estimateRecipeMacrosFlow(input);
}

const estimateRecipeMacrosPrompt = ai.definePrompt({
  name: 'estimateRecipeMacrosPrompt',
  input: {schema: EstimateRecipeMacrosInputSchema},
  output: {schema: EstimateRecipeMacrosOutputSchema},
  prompt: `You are an expert nutritionist and chef. Your task is to estimate the total macronutrients (proteins, carbohydrates, and fat) for a given recipe based on its ingredients.
Provide the results in grams. If the number of portions is provided, also calculate the macros per serving.

Recipe Name: {{{recipeName}}}
Ingredients:
{{#each ingredients}}
- {{{this}}}
{{/each}}
{{#if portions}}
Portions: {{{portions}}}
{{/if}}

Please provide an accurate estimation. If you make any assumptions (e.g., about specific ingredient types or common quantities), please include them in the 'notes' field.`,
});

const estimateRecipeMacrosFlow = ai.defineFlow(
  {
    name: 'estimateRecipeMacrosFlow',
    inputSchema: EstimateRecipeMacrosInputSchema,
    outputSchema: EstimateRecipeMacrosOutputSchema,
  },
  async input => {
    const {output} = await estimateRecipeMacrosPrompt(input);
    return output!;
  }
);
