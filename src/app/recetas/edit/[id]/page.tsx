import { RecipeEditClient } from "@/components/recipes/recipe-edit-client"

export default async function RecipeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecipeEditClient recipeId={id} />
}
