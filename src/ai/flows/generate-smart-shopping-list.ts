'use server';
/**
 * @fileOverview A Genkit flow for generating a smart shopping list.
 *
 * - generateSmartShoppingList - A function that handles the generation of the shopping list.
 * - GenerateSmartShoppingListInput - The input type for the generateSmartShoppingList function.
 * - GenerateSmartShoppingListOutput - The return type for the generateSmartShoppingList function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RecipeIngredientSchema = z.object({
  name: z.string().describe('The name of the ingredient.'),
  quantity: z.number().positive().describe('The quantity of the ingredient.'),
  unit: z.string().describe('The unit of measurement for the ingredient (e.g., "g", "ml", "pcs", "cup").'),
});

const PlannedRecipeSchema = z.object({
  name: z.string().describe('The name of the planned recipe.'),
  ingredients: z.array(RecipeIngredientSchema).describe('The list of ingredients for this recipe.'),
});

const PlannedMealSchema = z.object({
  date: z.string().describe('The date the meal is planned for (YYYY-MM-DD).'),
  mealType: z.string().describe('The type of meal (e.g., "breakfast", "lunch", "dinner", "snack").'),
  recipe: PlannedRecipeSchema.describe('The recipe planned for this meal.'),
});

const StockItemSchema = z.object({
  name: z.string().describe('The name of the ingredient in stock.'),
  quantity: z.number().min(0).describe('The current quantity of the ingredient in stock.'),
  unit: z.string().describe('The unit of measurement for the stock item (e.g., "g", "ml", "pcs", "cup").'),
});

export const GenerateSmartShoppingListInputSchema = z.object({
  plannedMeals: z.array(PlannedMealSchema).describe('A list of meals planned for the week.'),
  currentStock: z.array(StockItemSchema).describe('The user\'s current inventory of ingredients.'),
  additionalNotes: z.string().optional().describe('Any additional notes or preferences for the shopping list (e.g., "prefer organic", "avoid brand X").'),
});
export type GenerateSmartShoppingListInput = z.infer<typeof GenerateSmartShoppingListInputSchema>;

const ShoppingListItemSchema = z.object({
  ingredientName: z.string().describe('The name of the ingredient to buy.'),
  suggestedQuantity: z.number().positive().describe('The suggested quantity to buy.'),
  unit: z.string().describe('The unit of measurement for the suggested quantity.'),
  reason: z.string().optional().describe('The reason this item is on the list (e.g., "missing from stock", "low stock", "needed for recipe X").'),
});

export const GenerateSmartShoppingListOutputSchema = z.object({
  shoppingList: z.array(ShoppingListItemSchema).describe('The generated shopping list of ingredients to buy.'),
  summary: z.string().describe('A brief summary of the generated shopping list, highlighting key missing items.'),
});
export type GenerateSmartShoppingListOutput = z.infer<typeof GenerateSmartShoppingListOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateSmartShoppingListPrompt',
  input: { schema: GenerateSmartShoppingListInputSchema },
  output: { schema: GenerateSmartShoppingListOutputSchema },
  prompt: `You are an intelligent assistant for a family recipe management app called Cocina Familiar. Your task is to generate a smart shopping list based on the user's planned meals and their current ingredient stock.

Here are the ingredients required for all planned meals:
{{#if requiredItemsForPrompt}}
{{#each requiredItemsForPrompt}}
- {{this.name}}: {{this.quantity}} {{this.unit}}
{{/each}}
{{else}}
No meals are planned, so no ingredients are required.
{{/if}}

Here is the user's current ingredient stock:
{{#if stockItemsForPrompt}}
{{#each stockItemsForPrompt}}
- {{this.name}}: {{this.quantity}} {{this.unit}}
{{/each}}
{{else}}
The user currently has no ingredients in stock.
{{/if}}

{{#if additionalNotes}}
Additional notes from the user: {{{additionalNotes}}}
{{/if}}

Based on the required ingredients and the current stock, please generate a shopping list.
For each item in the shopping list, clearly state:
1. The ingredient name.
2. The suggested quantity to buy, considering what's needed for the planned meals and what's missing from stock.
3. The unit of measurement for the suggested quantity.
4. A brief reason for buying the item (e.g., "missing from stock", "low stock", "needed for recipe X").

Be concise and efficient. Only include items that actually need to be purchased. If an ingredient is fully covered by stock, do not include it in the shopping list. Try to consolidate items with similar units if possible, and make reasonable suggestions for quantities.

Provide a brief summary of the generated shopping list.`,
});

const generateSmartShoppingListFlow = ai.defineFlow(
  {
    name: 'generateSmartShoppingListFlow',
    inputSchema: GenerateSmartShoppingListInputSchema,
    outputSchema: GenerateSmartShoppingListOutputSchema,
  },
  async (input) => {
    const { plannedMeals, currentStock, additionalNotes } = input;

    // Aggregate required ingredients from planned meals
    const aggregatedRequiredIngredients: Record<string, { name: string; quantity: number; unit: string }> = {};
    plannedMeals.forEach(meal => {
      meal.recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim();
        if (aggregatedRequiredIngredients[key]) {
          aggregatedRequiredIngredients[key].quantity += ing.quantity;
        } else {
          aggregatedRequiredIngredients[key] = { name: ing.name, quantity: ing.quantity, unit: ing.unit };
        }
      });
    });

    const stockMap: Record<string, number> = {};
    currentStock.forEach(s => { stockMap[s.name.toLowerCase().trim()] = s.quantity; });

    const requiredItemsForPrompt = Object.values(aggregatedRequiredIngredients);
    const stockItemsForPrompt = currentStock;

    const { output } = await prompt({ plannedMeals, currentStock, additionalNotes, requiredItemsForPrompt, stockItemsForPrompt } as any);
    if (!output) throw new Error('El modelo no devolvió una lista válida');
    return output;
  }
);

export async function generateSmartShoppingList(input: GenerateSmartShoppingListInput): Promise<GenerateSmartShoppingListOutput> {
  return generateSmartShoppingListFlow(input);
}