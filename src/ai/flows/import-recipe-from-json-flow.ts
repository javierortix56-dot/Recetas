'use server';
/**
 * @fileOverview A Genkit flow for importing recipes from a JSON string,
 * updated for stricter typing, utensils and tips support.
 *
 * - importRecipeFromJson - The main function to import a recipe from JSON.
 * - ImportRecipeFromJsonInput - The input type for the importRecipeFromJson function.
 * - ImportRecipeFromJsonOutput - The return type for the importRecipeFromJson function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecipeIngredientSchema = z.object({
  nombre: z.string().describe('The name of the ingredient.'),
  cantidad: z.number().describe('The exact numeric quantity.'),
  unidad: z.string().describe('Standardized unit (g, ml, cucharada, etc.).'),
  preparacion: z.string().describe('Ingredient preparation notes.'),
  categoria: z.string().describe('Strict category mapping.'),
});

const RecipeStepSchema = z.object({
  orden: z.number().describe('Step order.'),
  titulo: z.string().describe('Step title.'),
  descripcion: z.string().describe('Detailed instruction.'),
  timerSegundos: z.number().nullable().describe('Optional timer in seconds.'),
});

const RecipeMacroSchema = z.object({
  calorias: z.number(),
  proteinas: z.number(),
  carbohidratos: z.number(),
  grasas: z.number(),
  fibra: z.number().optional(),
  azucar: z.number().optional(),
  sodio: z.number().optional(),
});

const RecipeSchema = z.object({
  nombre: z.string(),
  descripcion: z.string(),
  categorias: z.array(z.string()),
  porciones: z.number(),
  tiempoPreparacion: z.number(),
  tiempoCoccion: z.number(),
  dificultad: z.enum(['Fácil', 'Media', 'Difícil']),
  ingredientes: z.array(RecipeIngredientSchema),
  utensilios: z.array(z.string()).describe('List of necessary kitchen tools.'),
  pasos: z.array(RecipeStepSchema),
  tips: z.array(z.string()).describe('Chef tips and advice.'),
  macros: RecipeMacroSchema,
  tags: z.array(z.string()).optional(),
});

const ImportRecipeFromJsonInputSchema = z.object({
  recipeJson: z.string().describe('Strict JSON string representation.'),
  userStock: z.array(z.string()).describe('Current available stock names.'),
});

const ImportRecipeFromJsonOutputSchema = z.object({
  recipe: RecipeSchema,
  previewText: z.string(),
});

export async function importRecipeFromJson(input: z.infer<typeof ImportRecipeFromJsonInputSchema>) {
  return importRecipeFromJsonFlow(input);
}

const importRecipeFromJsonFlow = ai.defineFlow(
  {
    name: 'importRecipeFromJsonFlow',
    inputSchema: ImportRecipeFromJsonInputSchema,
    outputSchema: ImportRecipeFromJsonOutputSchema,
  },
  async (input) => {
    const {output} = await ai.generate({
      prompt: `Parse and validate the following recipe JSON against our strict schema.
      Rules: Ensure quantities are numeric, categories match our 8-standard types, and utensils are extracted correctly.
      
      JSON: ${input.recipeJson}
      USER STOCK: ${input.userStock.join(', ')}`,
      output: { schema: ImportRecipeFromJsonOutputSchema }
    });
    return output!;
  }
);
