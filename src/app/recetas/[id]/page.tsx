import { RecipeDetailClient } from "@/components/recipes/recipe-detail-client"

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecipeDetailClient recipeId={id} />
}
