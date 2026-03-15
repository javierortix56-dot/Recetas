import { config } from 'dotenv';
config();

import '@/ai/flows/estimate-recipe-macros-flow.ts';
import '@/ai/flows/import-recipe-from-json-flow.ts';
import '@/ai/flows/generate-smart-shopping-list.ts';
import '@/ai/flows/auto-plan-week-flow.ts';
import '@/ai/flows/auto-plan-day-flow.ts';
import '@/ai/flows/analyze-duplicates-flow.ts';
