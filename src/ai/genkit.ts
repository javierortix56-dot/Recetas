import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Modelos configurables por variable de entorno, para cambiarlos desde
 * Vercel sin tocar código. Por defecto, el más barato con capa gratuita.
 */
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite';
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(TEXT_MODEL),
});
