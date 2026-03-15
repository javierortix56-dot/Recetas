import { RecipeCookingClient } from "@/components/recipes/recipe-cooking-client"

export default async function RecipeCookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecipeCookingClient recipeId={id} />
}
