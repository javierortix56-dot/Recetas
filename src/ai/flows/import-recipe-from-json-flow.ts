'use server';
/**
 * @fileOverview A Genkit flow for importing recipes from a JSON string,
 * validating them, and matching ingredients against user stock.
 *
 * - importRecipeFromJson - The main function to import a recipe from JSON.
 * - ImportRecipeFromJsonInput - The input type for the importRecipeFromJson function.
 * - ImportRecipeFromJsonOutput - The return type for the importRecipeFromJson function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecipeIngredientSchema = z.object({
  nombre: z.string().describe('The name of the ingredient.'),
  cantidad: z
    .number()
    .describe('The quantity of the ingredient.'),
  unidad:
    z.string().describe('The unit of measurement for the ingredient (e.g., "units", "cups", "g").'),
  preparacion: z.string().describe('How to prepare the ingredient.'),
  categoria: z.enum(['Lácteos', 'Carnes', 'Verduras', 'Frutas', 'Almacén', 'Bebidas', 'Otros']).describe('Ingredient category.'),
});

const RecipeStepSchema = z.object({
  orden: z.number().describe('Step order.'),
  titulo: z.string().describe('Step title.'),
  descripcion: z.string().describe('Detailed instruction for this step.'),
  timerSegundos: z.number().nullable().describe('Optional timer for this step in seconds.'),
});

const RecipeMacroSchema = z.object({
  proteinas: z.number().describe('Protein content in grams.'),
  carbohidratos: z.number().describe('Carbohydrate content in grams.'),
  grasas: z.number().describe('Fat content in grams.'),
  calorias: z.number().describe('Total calories.'),
  fibra: z.number().optional(),
  azucar: z.number().optional(),
  sodio: z.number().optional(),
});

const RecipeSchema = z.object({
  nombre: z.string().describe('The name of the recipe.'),
  descripcion: z.string().describe('A brief description of the recipe.'),
  historia: z.string().optional().describe('Optional history or origin of the recipe.'),
  categorias: z.array(z.string()).describe('List of meal types (e.g., ["Desayuno", "Almuerzo"]).'),
  categoria: z.string().describe('The primary meal type.'),
  porciones: z.number().describe('The number of servings the recipe yields.'),
  tiempoPreparacion: z.number().describe('Preparation time in minutes.'),
  tiempoCoccion: z.number().describe('Cooking time in minutes.'),
  dificultad: z.enum(['Fácil', 'Media', 'Difícil']).describe('Difficulty level of the recipe.'),
  utensilios: z.array(z.string()).optional().describe('List of required utensils.'),
  consejoChef: z.string().optional().describe('A tip from the chef.'),
  ingredientes: z.array(RecipeIngredientSchema).describe('List of ingredients with quantities and categories.'),
  pasos: z.array(RecipeStepSchema).describe('Detailed step-by-step instructions.'),
  macros: RecipeMacroSchema.describe('Estimated nutritional macros for one portion.'),
  tags: z.array(z.string()).optional(),
});

const ImportRecipeFromJsonInputSchema = z.object({
  recipeJson: z
    .string()
    .describe('The JSON string representation of a recipe from an external AI model.'),
  userStock: z
    .array(z.string())
    .describe('A list of ingredient names currently available in the user\'s stock.'),
});
export type ImportRecipeFromJsonInput = z.infer<
  typeof ImportRecipeFromJsonInputSchema
>;

const ImportRecipeFromJsonOutputSchema = z.object({
  recipe: RecipeSchema.describe('The parsed and validated recipe.'),
  previewText:
    z.string().describe('A human-readable summary/preview of the imported recipe.'),
});
export type ImportRecipeFromJsonOutput = z.infer<
  typeof ImportRecipeFromJsonOutputSchema
>;

export async function importRecipeFromJson(
  input: ImportRecipeFromJsonInput
): Promise<ImportRecipeFromJsonOutput> {
  return importRecipeFromJsonFlow(input);
}

const importRecipeFromJsonPrompt = ai.definePrompt({
  name: 'importRecipeFromJsonPrompt',
  input: {schema: ImportRecipeFromJsonInputSchema},
  output: {schema: ImportRecipeFromJsonOutputSchema},
  prompt: `You are an expert recipe parser and ingredient stock manager.
Your task is to parse a JSON recipe provided by the user, validate its structure,
extract all relevant details, and then compare its ingredients against the user's current stock to determine availability.

The output MUST strictly adhere to the provided JSON schema. Do not include any additional text or formatting outside of the JSON.

User provided JSON recipe:
{{{recipeJson}}}

User's current stock of ingredients:
{{#if userStock}}
{{#each userStock}}
- {{{this}}}
{{/each}}
{{else}}
(No stock provided)
{{/if}}

For each ingredient in the parsed recipe, determine its category and check availability.
Ensure 'categorias' is an array of strings representing appropriate meal types (Desayuno, Almuerzo, Cena, etc.).

Generate a concise 'previewText' summary of the recipe, including its name, description,
preparation time, and cooking time.
`,
});

const importRecipeFromJsonFlow = ai.defineFlow(
  {
    name: 'importRecipeFromJsonFlow',
    inputSchema: ImportRecipeFromJsonInputSchema,
    outputSchema: ImportRecipeFromJsonOutputSchema,
  },
  async (input) => {
    const {output} = await importRecipeFromJsonPrompt(input);
    if (!output) {
      throw new Error('Failed to import recipe from JSON.');
    }
    return output;
  }
);
