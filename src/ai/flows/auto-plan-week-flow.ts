'use server';

import { ai } from '@/ai/genkit';
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
Tu tarea es organizar un menú semanal de 7 días comenzando el ${input.startDate}.

RECETAS DISPONIBLES (id, nombre, categorias, tags, macros):
${JSON.stringify(input.recipes, null, 2)}

REGLAS ESTRICTAS — NO ignorar ninguna:

1. ESTRUCTURA: Genera 4 comidas por día × 7 días = 28 planes en total.
   Momentos por día: "Desayuno", "Almuerzo", "Merienda", "Cena".

2. ASIGNACIÓN POR CATEGORÍAS (OBLIGATORIO):
   - Para "Desayuno": elige SOLO recetas cuyo campo "categorias" incluya "Desayuno".
   - Para "Almuerzo": elige SOLO recetas cuyo campo "categorias" incluya "Almuerzo".
   - Para "Cena": elige SOLO recetas cuyo campo "categorias" incluya "Cena".
   - Para "Merienda": elige recetas cuyo campo "categorias" incluya "Merienda" o "Snack".
   - Si no hay suficientes recetas para un momento, permite usar "Almuerzo"↔"Cena". NUNCA uses un Desayuno en la Cena.

3. SIN REPETICIÓN EN DÍAS CONSECUTIVOS: Si usaste el recipeId X el lunes en Almuerzo, NO lo uses el martes. Puede volver a aparecer después de 2 días de pausa.

4. VARIEDAD SEMANAL: No repitas el mismo recipeId más de 2 veces en toda la semana. Prioriza que todos los días tengan platos distintos.

5. USA TAGS para diversificar: mezcla tags como "rapido", "light", "proteico", "vegetariano", "comfort-food" a lo largo de la semana para mayor variedad nutricional.

6. MACROS: Si las recetas tienen macros, intenta balancear calorías diarias (no hagas días con todas las recetas calóricas juntas).

7. USA SOLO los recipeId e recipeName exactamente como aparecen en la lista proporcionada. NO inventes IDs ni nombres.

8. FORMATO: Devuelve JSON con "plans" (array de 28 elementos) y un "summary" motivador de 2-3 oraciones.`,
      output: { schema: AutoPlanWeekOutputSchema }
    });
    return output!;
  }
);
