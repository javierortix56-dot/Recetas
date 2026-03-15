'use server';
/**
 * @fileOverview Flow de Genkit para planificar automáticamente un día específico.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AutoPlanDayInputSchema = z.object({
  recipes: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    categorias: z.array(z.string()).optional(),
    categoria: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })),
  date: z.string().describe('Fecha en formato YYYY-MM-DD'),
});

const AutoPlanDayOutputSchema = z.object({
  plans: z.array(z.object({
    date: z.string(),
    mealType: z.enum(['Desayuno', 'Almuerzo', 'Merienda', 'Cena']),
    recipeId: z.string(),
    recipeName: z.string(),
  })),
  summary: z.string().describe('Breve resumen de por qué se eligieron estas comidas'),
});

export async function autoPlanDay(input: z.infer<typeof AutoPlanDayInputSchema>) {
  return autoPlanDayFlow(input);
}

const autoPlanDayFlow = ai.defineFlow(
  {
    name: 'autoPlanDayFlow',
    inputSchema: AutoPlanDayInputSchema,
    outputSchema: AutoPlanDayOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Eres un experto chef y nutricionista de "Cocina Familiar". 
      Tu tarea es organizar el menú de un día específico: ${input.date}.
      
      RECETAS DISPONIBLES:
      ${JSON.stringify(input.recipes)}
      
      REGLAS:
      1. Genera exactamente 4 comidas: Desayuno, Almuerzo, Merienda, Cena.
      2. Usa SOLO las recetas de la lista proporcionada.
      3. Intenta que el menú sea variado y equilibrado.
      4. Respeta las categorías (ej. no pongas una receta de "Cena" en el "Desayuno" a menos que no haya otra opción).
      5. Devuelve un JSON con el array "plans" y un "summary" motivador.`,
      output: { schema: AutoPlanDayOutputSchema }
    });
    return output!;
  }
);
