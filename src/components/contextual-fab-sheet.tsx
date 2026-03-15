"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { 
  Plus, 
  ChefHat, 
  Download, 
  Package, 
  Calendar, 
  ShoppingCart, 
  Activity 
} from "lucide-react"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { RecipeImportModal } from "@/components/recipe-import-modal"
import { StockFormDialog } from "@/components/stock/stock-form-dialog"
import { AddMealPlanDialog } from "@/components/plan/add-meal-plan-dialog"
import { AddShoppingItemDialog } from "@/components/shopping/add-shopping-item-dialog"
import { AddMealLogDialog } from "@/components/macros/add-meal-log-dialog"
import { format } from "date-fns"

export function ContextualFabSheet() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  
  // Modals visibility
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  
  const getOptions = () => {
    if (pathname.startsWith("/recetas") || pathname === "/inicio") {
      return [
        { 
          label: "Nueva receta", 
          icon: ChefHat, 
          onClick: () => { setIsOpen(false); router.push("/recetas/nueva") } 
        },
        { 
          label: "Importar receta con IA", 
          icon: Download, 
          onClick: () => { setIsOpen(false); setIsImportOpen(true) } 
        }
      ]
    }
    if (pathname.startsWith("/stock")) {
      return [
        { 
          label: "Nuevo ingrediente", 
          icon: Package, 
          action: <StockFormDialog /> 
        }
      ]
    }
    if (pathname.startsWith("/planificacion")) {
      return [
        { 
          label: "Planificar comida", 
          icon: Calendar, 
          action: <AddMealPlanDialog date={new Date()} momento="Almuerzo"><Button className="w-full justify-start h-14 rounded-2xl gap-4" variant="ghost"><Calendar className="h-6 w-6 text-primary" /><span className="font-bold">Planificar comida</span></Button></AddMealPlanDialog> 
        }
      ]
    }
    if (pathname.startsWith("/compras")) {
      return [
        { 
          label: "Agregar ítem manualmente", 
          icon: ShoppingCart, 
          action: <AddShoppingItemDialog><Button className="w-full justify-start h-14 rounded-2xl gap-4" variant="ghost"><ShoppingCart className="h-6 w-6 text-primary" /><span className="font-bold">Agregar ítem manualmente</span></Button></AddShoppingItemDialog> 
        }
      ]
    }
    if (pathname.startsWith("/macros")) {
      return [
        { 
          label: "Registrar comida", 
          icon: Activity, 
          action: <AddMealLogDialog date={format(new Date(), "yyyy-MM-dd")}><Button className="w-full justify-start h-14 rounded-2xl gap-4" variant="ghost"><Activity className="h-6 w-6 text-primary" /><span className="font-bold">Registrar comida</span></Button></AddMealLogDialog> 
        }
      ]
    }
    return []
  }

  const options = getOptions()

  if (options.length === 0) return null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button 
            className="absolute -top-14 left-1/2 -translate-x-1/2 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform z-[60]"
            aria-label="Añadir nuevo"
          >
            <Plus className="h-8 w-8" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-12">
          <SheetHeader className="mb-6">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4" />
            <SheetTitle className="text-left font-black text-primary text-xl">¿Qué querés hacer?</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2">
            {options.map((opt, i) => (
              <React.Fragment key={i}>
                {opt.action ? (
                  <div onClick={() => setIsOpen(false)}>{opt.action}</div>
                ) : (
                  <Button 
                    variant="ghost" 
                    className="h-14 rounded-2xl justify-start gap-4 hover:bg-primary-suave"
                    onClick={opt.onClick}
                  >
                    <opt.icon className="h-6 w-6 text-primary" />
                    <span className="font-bold">{opt.label}</span>
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <RecipeImportModal open={isImportOpen} onOpenChange={setIsImportOpen} />
    </>
  )
}
