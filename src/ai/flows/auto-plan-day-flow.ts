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

    // Normalize: merge `categoria` (string) into `categorias` (array) for consistent matching
    const normalizedRecipes = input.recipes.map(r => ({
      ...r,
      categorias: r.categorias?.length
        ? r.categorias
        : r.categoria
        ? [r.categoria]
        : [],
    }));

    const { output } = await ai.generate({
      prompt: `Eres un asistente de planificación de menús. Genera el plan del día ${input.date}.

RECETAS DISPONIBLES:
${JSON.stringify(normalizedRecipes, null, 2)}

${recentIds.length > 0 ? `IDs a evitar si hay alternativas (usados ayer): ${JSON.stringify(recentIds)}\n` : ''}

INSTRUCCIONES:
1. Devuelve exactamente 4 planes con mealType: "Desayuno", "Almuerzo", "Merienda", "Cena".
2. Para cada mealType, elige preferentemente una receta cuyo campo "categorias" contenga ese mealType.
   - "Merienda" puede usar recetas con "Merienda" o "Snack" en categorias.
   - Si no hay receta con la categoría exacta, usa cualquier receta disponible. NUNCA dejes un mealType sin asignar.
3. No uses el mismo id dos veces en el mismo día.
4. Evita los IDs del día anterior si hay alternativas.
5. Usa SOLO los id y nombre exactamente como aparecen en la lista. No inventes valores.
6. El campo "summary" debe ser 1-2 oraciones motivadoras sobre el menú del día.`,
      output: { schema: AutoPlanDayOutputSchema }
    });
    if (!output) throw new Error('El modelo no devolvió un plan válido');
    return output;
  }
);
