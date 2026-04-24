'use server';

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
  recentlyUsedRecipeIds: z.array(z.string()).optional().describe('IDs de recetas usadas el día anterior — evitar repetirlas'),
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
    const recentIds = input.recentlyUsedRecipeIds || [];

    const { output } = await ai.generate({
      prompt: `Eres un experto chef y nutricionista de "Cocina Familiar".
Tu tarea es organizar el menú del día ${input.date} con exactamente 4 comidas.

RECETAS DISPONIBLES (id, nombre, categorias, tags):
${JSON.stringify(input.recipes, null, 2)}

${recentIds.length > 0 ? `RECETAS USADAS AYER (evitar repetir estos IDs si hay alternativas):
${JSON.stringify(recentIds)}

` : ''}REGLAS ESTRICTAS — NO ignorar ninguna:

1. MOMENTOS: Genera exactamente 4 planes con mealType: "Desayuno", "Almuerzo", "Merienda", "Cena".

2. ASIGNACIÓN POR CATEGORÍAS (OBLIGATORIO):
   - Para "Desayuno": elige SOLO recetas cuyo campo "categorias" incluya "Desayuno".
   - Para "Almuerzo": elige SOLO recetas cuyo campo "categorias" incluya "Almuerzo".
   - Para "Cena": elige SOLO recetas cuyo campo "categorias" incluya "Cena".
   - Para "Merienda": elige recetas cuyo campo "categorias" incluya "Merienda" o "Snack".
   - Si no hay recetas suficientes para un momento, permite usar recetas de categoría "Almuerzo" para la "Cena" o viceversa. NUNCA pongas un Desayuno en la Cena.

3. TAGS para priorizar: prefiere recetas variadas en tags. Si hay recetas con "rapido" para el Desayuno, úsalas. Si hay "vegetariano" o "light" para la Merienda, úsalas.

4. NO REPETIR: No uses el mismo recipeId dos veces en el mismo día.

5. EVITAR recetas del día anterior (listadas en recentlyUsedRecipeIds) si hay alternativas disponibles.

6. USA SOLO los recipeId e recipeName exactamente como aparecen en la lista proporcionada. NO inventes IDs ni nombres.

7. Devuelve JSON con "plans" (array de 4 elementos) y un "summary" motivador de 1-2 oraciones.`,
      output: { schema: AutoPlanDayOutputSchema }
    });
    if (!output) throw new Error('El modelo no devolvió un plan válido');
    return output;
  }
);
