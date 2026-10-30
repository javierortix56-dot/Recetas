"use client"

import { Loader2 } from "lucide-react"
import { useAppStore } from "@/store/app-store"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { EmptyState } from "@/components/ui/page-header"
import { ChefHat } from "lucide-react"

export function RecipeEditClient({ recipeId }: { recipeId: string }) {
  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const recetasCargadas = useAppStore(s => s.recetasCargadas)

  if (!receta) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        {recetasCargadas
          ? <EmptyState icon={ChefHat} title="Receta no encontrada" />
          : <Loader2 className="h-8 w-8 text-primary animate-spin" />}
      </div>
    )
  }
  // key: si la receta cambia de id, el formulario arranca de cero
  return <RecipeForm key={receta.id} recipe={receta} />
}
