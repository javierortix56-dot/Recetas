# **App Name**: Cocina Familiar

## Core Features:

- User Authentication & Profiles: Secure user registration and login with Firebase Auth (Google login) to manage personal recipe collections and app settings.
- Recipe Listing & Detail (Recetas): View recipes in a grid with filters and search. Detailed view includes hero photo, preparation/cooking times, difficulty, chef's tip, ingredients with stock indicators, and ultra-detailed step-by-step instructions with timers. Macros are displayed with an interactive portion selector.
- Recipe Creation & Editing (Recetas): Create and edit recipes with fields for name, description, history, category, portions, times, difficulty, utensils, chef's tip, ingredients, detailed steps, and nutritional macros. Supports image uploads to Firebase Storage.
- Recipe Import from JSON (AI Tool): A generative AI tool that allows users to paste a JSON recipe (from external AI models like ChatGPT) for validation, preview, and automatic matching of ingredients with existing stock, then saves it to Firestore. Provides a suggested prompt for external AI.
- Ingredient Stock Management (Stock): Maintain an inventory of available ingredients, grouped by category. Each item shows current stock versus minimum, with color-coded progress bars. Users can adjust stock and add new ingredients with their nutritional macros.
- Meal Planning Calendar (Planificación): Plan meals on a weekly calendar, assigning recipes to specific days and meal times. Automatically registers planned meals in the daily macro tracker. Includes navigation between weeks and a summary of weekly macros.
- Smart Shopping List Generator (Compras): A generative AI tool that automatically generates a shopping list based on planned meals, cross-referencing with the user's ingredient stock. It highlights missing items, suggests quantities, and allows manual additions. Users can mark items as purchased and update stock automatically.
- Nutritional Macro Tracking & Calculator (Macros): A generative AI tool that estimates and tracks the macronutrient breakdown (proteins, carbohydrates, fats, etc.) of recipes based on ingredients. Features daily and weekly views with circular progress rings for consumption vs. goals, and allows setting daily macro objectives.

## Style Guidelines:

- Emerald green (#2D9A6B) as the primary color, evoking freshness and natural ingredients.
- Soft primary green (#E8F5EF) for backgrounds and badges, providing a gentle contrast.
- Warm yellow (#F59E0B) as an accent color for highlights and interactive elements.
- Coral red (#F43F5E) for error messages and alerts.
- Very light, subtly green-tinted off-white (#F7FAF8) for the general background, promoting a spacious and airy feel.
- Pure white (#FFFFFF) for card backgrounds, ensuring content stands out.
- Dark charcoal (#1A2E24) for primary text, ensuring high readability.
- Medium gray (#6B7280) for secondary text and descriptive elements.
- Light gray (#E5E7EB) for subtle borders and separators.
- 'Inter' from Google Fonts is used throughout the app for its modern, neutral, and highly readable characteristics. Configured with 'font-variant-numeric: tabular-nums' for aligned numbers.
- Simple, clean line-art icons that are easily recognizable and relevant to cooking, ingredients, and planning, ensuring clear visual communication on mobile screens. Specific emojis and icons are used for utensils and chef's tips.
- A mobile-first responsive layout with a prominent bottom navigation bar for the five main sections (Recetas, Stock, Planificación, Compras, Macros). Cards feature 'rounded-2xl' corners, subtle shadows ('0 2px 12px rgba(0,0,0,0.06)'), and a white background. A floating '+' button in primary green is available for adding content.
- Subtle and quick transitions ('transition-all duration-200') for tab switching, content loading, button hovers, and other interactions to enhance user experience without being distracting. Skeleton loaders are used for list views during data loading.