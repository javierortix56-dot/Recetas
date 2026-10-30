'use server';
/**
 * @fileOverview Genera una receta completa a partir de un pedido en lenguaje
 * natural ("risotto de hongos para 4") y, por separado, una foto del plato.
 * Son dos llamadas para que cada una entre holgada en el tiempo máximo de la
 * función y para poder regenerar solo la foto.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { RECIPE_RULES } from '@/lib/recipe-prompt';

const CATEGORIAS_RECETA = ['Desayuno', 'Almuerzo', 'Cena', 'Merienda', 'Postre', 'Snack'] as const;
const UNIDADES = ['g', 'kg', 'ml', 'l', 'unidad', 'cucharada', 'cucharadita', 'taza', 'docena'] as const;
const CATEGORIAS_DESPENSA = [
  'Lácteos y Huevos', 'Carnes y Aves', 'Pescados y Mariscos', 'Frutas y Verduras',
  'Almacén', 'Especias y Condimentos', 'Bebidas', 'Otros',
] as const;

const GenerateRecipeInputSchema = z.object({
  pedido: z.string().min(2).max(500).describe('Qué receta quiere el usuario, con los detalles que quiera agregar'),
  porciones: z.number().int().min(1).max(20).optional(),
});
export type GenerateRecipeInput = z.infer<typeof GenerateRecipeInputSchema>;

const RecipeSchema = z.object({
  nombre: z.string(),
  descripcion: z.string(),
  historia: z.string(),
  categorias: z.array(z.enum(CATEGORIAS_RECETA)).min(1),
  porciones: z.number().int(),
  tiempoPreparacion: z.number().int().describe('minutos de trabajo activo'),
  tiempoCoccion: z.number().int().describe('minutos de cocción o reposo'),
  dificultad: z.enum(['Fácil', 'Media', 'Difícil']),
  ingredientes: z.array(z.object({
    nombre: z.string(),
    cantidad: z.number(),
    unidad: z.enum(UNIDADES),
    preparacion: z.string(),
    categoria: z.enum(CATEGORIAS_DESPENSA),
  })),
  utensilios: z.array(z.string()),
  pasos: z.array(z.object({
    orden: z.number().int(),
    titulo: z.string(),
    descripcion: z.string(),
    timerSegundos: z.number().int().nullable().describe('segundos si el paso tiene un tiempo de espera concreto, si no null'),
  })),
  tips: z.array(z.string()),
  macros: z.object({
    calorias: z.number(),
    proteinas: z.number(),
    carbohidratos: z.number(),
    grasas: z.number(),
    fibra: z.number(),
    azucar: z.number(),
    sodio: z.number(),
    pesoPorPorcion: z.number(),
  }).describe('por porción individual'),
  tags: z.array(z.string()),
});
export type GeneratedRecipe = z.infer<typeof RecipeSchema>;

const generateRecipeFlow = ai.defineFlow(
  { name: 'generateRecipeFlow', inputSchema: GenerateRecipeInputSchema, outputSchema: RecipeSchema },
  async ({ pedido, porciones }) => {
    const { output } = await ai.generate({
      system: `Sos un chef profesional con foco en técnica y autenticidad (cocina italiana, argentina e internacional). Escribís en español rioplatense.\n\n${RECIPE_RULES}`,
      prompt: `Armá la receta que pide el usuario.\nPedido: ${pedido}${porciones ? `\nPorciones: ${porciones}` : ''}`,
      output: { schema: RecipeSchema },
    });
    if (!output) throw new Error('La IA no devolvió una receta');
    return output;
  }
);

export async function generateRecipe(input: GenerateRecipeInput): Promise<GeneratedRecipe> {
  return generateRecipeFlow(input);
}

const GenerateImageInputSchema = z.object({
  nombre: z.string(),
  descripcion: z.string().optional(),
});

const generateRecipeImageFlow = ai.defineFlow(
  { name: 'generateRecipeImageFlow', inputSchema: GenerateImageInputSchema, outputSchema: z.string() },
  async ({ nombre, descripcion }) => {
    const response = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image'),
      prompt:
        `Fotografía gastronómica realista de "${nombre}"${descripcion ? ` (${descripcion})` : ''}, ` +
        'servido en un plato, vista a 45 grados, luz natural suave, fondo de cocina desenfocado, ' +
        'sin texto, sin manos, sin logos. Formato horizontal 4:3.',
      config: { responseModalities: ['IMAGE'] },
    });
    const url = response.media?.url;
    if (!url) throw new Error('La IA no devolvió una imagen');
    return url;
  }
);

/** Devuelve la foto como data URL (PNG). El cliente la comprime a JPEG antes de guardarla. */
export async function generateRecipeImage(input: { nombre: string; descripcion?: string }): Promise<string> {
  return generateRecipeImageFlow(input);
}
