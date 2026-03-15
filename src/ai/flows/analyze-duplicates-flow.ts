'use server';
/**
 * @fileOverview Flow de Genkit para analizar una lista de ingredientes y sugerir agrupaciones inteligentes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeDuplicatesInputSchema = z.object({
  ingredientNames: z.array(z.string()).describe('Lista completa de nombres de ingredientes en la despensa'),
});

const AnalyzeDuplicatesOutputSchema = z.object({
  suggestions: z.array(z.object({
    mainName: z.string().describe('El nombre sugerido como principal para el grupo'),
    duplicates: z.array(z.string()).describe('Lista de nombres detectados como variantes o duplicados del principal'),
    reason: z.string().describe('Breve explicación de por qué se agruparon'),
  })),
});

export async function analyzeDuplicates(input: z.infer<typeof AnalyzeDuplicatesInputSchema>) {
  return analyzeDuplicatesFlow(input);
}

const analyzeDuplicatesFlow = ai.defineFlow(
  {
    name: 'analyzeDuplicatesFlow',
    inputSchema: AnalyzeDuplicatesInputSchema,
    outputSchema: AnalyzeDuplicatesOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Eres un experto en gestión de inventarios de cocina.
      Analiza la siguiente lista de ingredientes y detecta duplicados o variantes que deberían ser un solo producto.
      
      CRITERIOS DE AGRUPACIÓN:
      1. Variantes de un mismo producto (ej: "Papa", "Papa Negra", "Papa Blanca" -> "Papa").
      2. Errores de escritura o plurales (ej: "Zanahoria", "Zanahorias").
      3. Marcas vs Genéricos si no es relevante (ej: "Arroz Lucchetti", "Arroz").
      
      REGLAS:
      - Solo agrupa si estás muy seguro de que en una receta son intercambiables.
      - El "mainName" debe ser el nombre más claro y genérico.
      - Devuelve un JSON con el array "suggestions".
      
      LISTA DE INGREDIENTES:
      ${input.ingredientNames.join(', ')}`,
      output: { schema: AnalyzeDuplicatesOutputSchema }
    });
    return output!;
  }
);
