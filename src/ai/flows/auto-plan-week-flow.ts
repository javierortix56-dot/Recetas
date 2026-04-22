'use server';

import { ai, isAIConfigured } from '@/ai/genkit';
import { z } from 'genkit';

const AutoPlanWeekInputSchema = z.object({
  recipes: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    categorias: z.array(z.string()).optional(),
    categoria: z.string().optional(),
    tags: z.array(z.string()).optional(),
    macros: z.any().optional(),
  })),
  startDate: z.string().describe('Fecha de inicio en formato YYYY-MM-DD'),
});

const AutoPlanWeekOutputSchema = z.object({
  plans: z.array(z.object({
    date: z.string(),
    mealType: z.enum(['Desayuno', 'Almuerzo', 'Merienda', 'Cena']),
    recipeId: z.string(),
    recipeName: z.string(),
  })),
  summary: z.string().describe('Breve resumen de por qué se eligieron estas comidas'),
});

export async function autoPlanWeek(input: z.infer<typeof AutoPlanWeekInputSchema>) {
  if (!isAIConfigured()) {
    throw new Error('GOOGLE_GENAI_API_KEY no está configurada. Agregala en las variables de entorno de Vercel.');
  }
  return autoPlanWeekFlow(input);
}

const autoPlanWeekFlow = ai.defineFlow(
  {
    name: 'autoPlanWeekFlow',
    inputSchema: AutoPlanWeekInputSchema,
    outputSchema: AutoPlanWeekOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Eres un experto chef y nutricionista de "Cocina Familiar". 
      Tu tarea es organizar un menú semanal (7 días) empezando el ${input.startDate}.
      
      RECETAS DISPONIBLES:
      ${JSON.stringify(input.recipes)}
      
      REGLAS:
      1. Genera 4 comidas por día: Desayuno, Almuerzo, Merienda, Cena.
      2. Usa SOLO las recetas de la lista proporcionada.
      3. Intenta que el menú sea variado. No repitas el mismo plato principal dos días seguidos.
      4. Respeta las categorías (ej. no pongas una receta de "Desayuno" en la "Cena" a menos que no haya otra opción).
      5. Devuelve un JSON con el array "plans" y un "summary" motivador.`,
      output: { schema: AutoPlanWeekOutputSchema }
    });
    if (!output) throw new Error('El modelo no devolvió un plan válido');
    return output;
  }
);
