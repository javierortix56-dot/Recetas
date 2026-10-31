'use server';
import { requireUser } from '@/lib/server-auth';
/**
 * @fileOverview Detecta ingredientes repetidos entre la despensa y las recetas.
 * Primero agrupa sin IA los que solo cambian en escritura (tildes, plural,
 * mayúsculas); después la IA propone variantes, con reglas estrictas para no
 * juntar productos distintos ("Cebolla" con "Cebolla en polvo").
 */

import { ai, TEXT_MODEL } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { nameKey } from '@/lib/ingredient-groups';

// Detectar duplicados exige más criterio que armar una receta: se usa Flash (también con capa gratuita)
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash';

const ItemSchema = z.object({
  nombre: z.string(),
  categoria: z.string().optional(),
  unidad: z.string().optional(),
  enDespensa: z.boolean(),
  usos: z.array(z.string()).describe('"Receta (preparación)" donde se usa'),
});
const AnalyzeDuplicatesInputSchema = z.object({ items: z.array(ItemSchema) });

const SuggestionSchema = z.object({
  mainName: z.string().describe('Nombre que queda para el grupo'),
  duplicates: z.array(z.string()).describe('Todos los nombres del grupo, copiados exactos de la lista (incluido el principal si está)'),
  confidence: z.enum(['alta', 'media']),
  reason: z.string().describe('Por qué son el mismo producto, en una oración'),
});
const AnalyzeDuplicatesOutputSchema = z.object({ suggestions: z.array(SuggestionSchema) });
export type DuplicateSuggestion = z.infer<typeof SuggestionSchema>;

const PROMPT = `Sos un experto en compras de supermercado en Argentina y en cocina.
Te paso los ingredientes de una despensa familiar y de sus recetas. Encontrá los que son EL MISMO producto escrito de distintas formas, para unificarlos en uno solo. Unificar un grupo suma su stock y renombra el ingrediente en todas las recetas, así que un error junta productos distintos en la lista de compras.

AGRUPAR solo si se compran como el mismo producto y uno reemplaza al otro en cualquier receta sin cambiar el resultado:
- Distinta escritura, tildes, mayúsculas o plural: "Morron rojo" / "Morrón rojo".
- Sinónimos regionales de la misma variedad: "Pimiento rojo" / "Morrón rojo", "Aguacate" / "Palta", "Frijoles negros" / "Porotos negros".
- Un agregado que describe cómo se usa y no qué se compra: "Agua" / "Agua tibia", "Huevo" / "Huevo a temperatura ambiente".
- Un nombre con alternativas o aclaraciones del mismo producto: "Queso costeño" / "Queso costeño o semiduro", "Parmesano en bloque" / "Queso parmesano".
- Variedades que en Argentina se compran indistintamente para cocinar: "Papa" / "Papa blanca" / "Papa negra", "Cebolla" / "Cebolla blanca", "Tomate" / "Tomate redondo".
- Una marca y su genérico: "Arroz Gallo" / "Arroz blanco".

NO AGRUPAR NUNCA:
- Distinta forma o presentación: fresco vs. seco, en polvo, deshidratado o en conserva ("Jengibre" / "Jengibre en polvo", "Cebolla" / "Cebolla en polvo", "Canela en rama" / "Canela en polvo", "Tomate" / "Puré de tomate").
- Productos distintos que comparten una palabra: "Leche entera" / "Leche de coco", "Manteca" / "Mantequilla de maní", "Cebolla" / "Cebolla larga" (es verdeo), "Harina de trigo" / "Harina de maíz", "Chorizo" / "Bife de chorizo", "Limón" / "Jugo de limón".
- Distintos cortes o animales: "Pechuga de pollo" / "Muslo de pollo", "Lomo" / "Solomillo", "Carne molida de res" / "Carne molida de cerdo".
- Variedades con uso culinario distinto: "Arroz arborio" / "Arroz basmati" / "Arroz blanco", "Aceite de oliva" / "Aceite de girasol", "Plátano verde" / "Plátano maduro", "Yogur natural" / "Yogur griego", "Vino tinto" / "Vino blanco", "Queso parmesano" / "Queso reggianito", "Tomate" / "Tomate perita".
- Ante la duda, NO agrupar. Es mejor dejar un duplicado que juntar dos productos distintos.

Usá la categoría, la unidad y las recetas donde se usa cada uno para decidir: si en una receta "Agua tibia" es para la masa, sigue siendo agua.

CONFIANZA:
- "alta": solo cambia la escritura, es un sinónimo exacto o el agregado describe la preparación.
- "media": variedades intercambiables o un genérico frente a uno más específico.

NOMBRE PRINCIPAL ("mainName"): preferí uno que ya esté en la lista; si no, el nombre más claro como se lo busca en un supermercado argentino ("Morrón rojo", "Palta", "Choclo"). Primera letra en mayúscula, en singular, sin marca ni preparación.

"duplicates" debe tener al menos dos nombres, copiados EXACTOS de la lista. Un nombre puede estar en un solo grupo. No incluyas grupos de un solo nombre.

INGREDIENTES (nombre [categoría · unidad · dónde está] usos):
`;

function describe(item: z.infer<typeof ItemSchema>): string {
  const where = item.enDespensa ? 'despensa' : 'solo en recetas';
  const meta = [item.categoria, item.unidad, where].filter(Boolean).join(' · ');
  const usos = item.usos.length ? ` usos: ${item.usos.slice(0, 4).join('; ')}` : '';
  return `- ${item.nombre} [${meta}]${usos}`;
}

async function askModel(prompt: string) {
  const request = { prompt, output: { schema: AnalyzeDuplicatesOutputSchema } };
  try {
    return (await ai.generate({ ...request, model: googleAI.model(ANALYSIS_MODEL) })).output;
  } catch (e) {
    if (ANALYSIS_MODEL === TEXT_MODEL) throw e;
    console.warn('[duplicados] falló', ANALYSIS_MODEL, '→ se usa', TEXT_MODEL, e);
    return (await ai.generate(request)).output;
  }
}

const analyzeDuplicatesFlow = ai.defineFlow(
  { name: 'analyzeDuplicatesFlow', inputSchema: AnalyzeDuplicatesInputSchema, outputSchema: AnalyzeDuplicatesOutputSchema },
  async ({ items }) => {
    // Nombre exacto por clave: la IA a veces cambia mayúsculas o tildes al copiar
    const byKey = new Map<string, string[]>();
    items.forEach(i => byKey.set(nameKey(i.nombre), [...(byKey.get(nameKey(i.nombre)) || []), i.nombre]));
    const resolve = (n: string) => byKey.get(nameKey(n)) || [];

    // Unión de grupos: los de escritura (seguros) y los de la IA se fusionan si comparten un nombre
    const groups: { names: Set<string>; main?: string; confidence: 'alta' | 'media'; reasons: string[] }[] = [];
    const add = (names: string[], confidence: 'alta' | 'media', reason: string, main?: string) => {
      const set = new Set(names);
      const hits = groups.filter(g => [...set].some(n => g.names.has(n)));
      const target = hits[0] || { names: new Set<string>(), confidence, reasons: [] as string[] };
      if (!hits.length) groups.push(target);
      hits.slice(1).forEach(g => { g.names.forEach(n => target.names.add(n)); target.reasons.push(...g.reasons); if (g.confidence === 'media') target.confidence = 'media'; groups.splice(groups.indexOf(g), 1); });
      set.forEach(n => target.names.add(n));
      if (confidence === 'media') target.confidence = 'media';
      if (!target.reasons.includes(reason)) target.reasons.push(reason);
      if (main && !target.main) target.main = main;
    };

    byKey.forEach(names => { if (names.length > 1) add(names, 'alta', 'Mismo producto con distinta escritura.'); });

    if (items.length > 1) {
      const output = await askModel(PROMPT + items.map(describe).join('\n'));
      for (const s of output?.suggestions || []) {
        const names = Array.from(new Set([...s.duplicates, s.mainName].flatMap(resolve)));
        if (new Set(names.map(nameKey)).size < 2) continue;
        add(names, s.confidence, s.reason, s.mainName.trim());
      }
    }

    const despensa = new Set(items.filter(i => i.enDespensa).map(i => i.nombre));
    return {
      suggestions: groups.map(g => {
        const names = [...g.names];
        // Sin principal de la IA: el que está en la despensa, con tilde y mayúscula
        const fallback = names.find(n => despensa.has(n) && /[áéíóúñ]/i.test(n)) || names.find(n => despensa.has(n)) || names[0];
        return { mainName: g.main || fallback, duplicates: names, confidence: g.confidence, reason: g.reasons.join(' ') };
      }),
    };
  }
);

export async function analyzeDuplicates(input: z.infer<typeof AnalyzeDuplicatesInputSchema>) {
  await requireUser();
  return analyzeDuplicatesFlow(input);
}
