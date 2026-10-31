'use server';
/**
 * @fileOverview Genera una receta completa a partir de un pedido en lenguaje
 * natural ("risotto de hongos para 4") y, por separado, una foto del plato.
 * Son dos llamadas para que cada una entre holgada en el tiempo máximo de la
 * función y para poder regenerar solo la foto.
 */

import { ai, IMAGE_MODEL } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { PROMPT_TEMPLATE } from '@/lib/recipe-prompt';

const CATEGORIAS_RECETA = ['Desayuno', 'Almuerzo', 'Cena', 'Merienda', 'Postre', 'Snack'] as const;
const UNIDADES = ['g', 'kg', 'ml', 'l', 'unidad', 'cucharada', 'cucharadita', 'taza', 'docena'] as const;
const CATEGORIAS_DESPENSA = [
  'Lácteos y Huevos', 'Carnes y Aves', 'Pescados y Mariscos', 'Frutas y Verduras',
  'Almacén', 'Especias y Condimentos', 'Bebidas', 'Otros',
] as const;

const GenerateRecipeInputSchema = z.object({
  pedido: z.string().min(2).max(500).describe('Qué receta quiere el usuario, con los detalles que quiera agregar'),
  porciones: z.number().int().min(1).max(20).optional(),
  despensa: z.array(z.string()).max(1000).optional().describe('Nombres de la despensa, para reutilizarlos'),
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
  async ({ pedido, porciones, despensa }) => {
    // Se usa el prompt maestro completo (el mismo de las recetas ya cargadas) y se le
    // agrega el pedido. La salida se valida contra el esquema, que refleja su formato JSON.
    const { output } = await ai.generate({
      prompt:
        `${PROMPT_TEMPLATE}\n\n━━━ PEDIDO ━━━\n` +
        `Generá UNA sola receta (un objeto, no un array) para este pedido: ${pedido}` +
        (porciones ? `\nPorciones: ${porciones}` : '') +
        // Mismo producto, mismo nombre: así no se crean duplicados en la despensa
        (despensa?.length
          ? `\n\n━━━ DESPENSA ACTUAL ━━━\nSi un ingrediente es el mismo producto que uno de esta lista, usá ese nombre exacto ` +
            `(ej: si está "Morrón rojo", no pongas "pimiento rojo"). No lo reutilices si cambia la forma o variedad ` +
            `("cebolla" no es "Cebolla en polvo"). Si no está, seguí la regla de "nombre".\n${despensa.join(' | ')}`
          : ''),
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
      model: googleAI.model(IMAGE_MODEL),
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
