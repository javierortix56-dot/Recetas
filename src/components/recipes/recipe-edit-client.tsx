"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Image as ImageIcon, Loader2, X, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { compressImageToBase64 } from "@/lib/utils"
import { USER_ID } from "@/lib/constants"
import Image from "next/image"
import { normalizeIngredientName, categorizeIngredient } from "@/lib/categorizeIngredient"
import { useAppStore } from "@/store/app-store"
import { getSafeImageSource } from "@/lib/utils"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

const CATEGORIES = ["Desayuno", "Almuerzo", "Cena", "Merienda", "Postre", "Snack"]

export function RecipeEditClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const db = useFirestore()

  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const recetasCargadas = useAppStore(s => s.recetasCargadas)
  const isLoading = !recetasCargadas

  const [formData, setFormData] = React.useState<any>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [newUtensil, setNewUtensil] = React.useState("")

  React.useEffect(() => {
    if (receta && !formData) {
      setFormData({
        ...receta,
        utensilios: receta.utensilios || [],
        tips: receta.tips || [],
        categorias: Array.isArray(receta.categorias) ? receta.categorias : (receta.categoria ? [receta.categoria] : ["Almuerzo"]),
        ingredientes: receta.ingredientes || [],
        pasos: receta.pasos || [],
        macros: receta.macros || { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
      })
      setImagePreview(getSafeImageSource(receta))
    }
  }, [receta, formData])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!formData.nombre || !db || !recipeId) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El nombre es obligatorio." })
      return
    }

    setIsSaving(true)
    let finalFotoURL = formData.fotoURL || formData.imageUrl || null

    try {
      if (imageFile) {
        toast({ title: "Procesando imagen..." });
        finalFotoURL = await compressImageToBase64(imageFile);
      }

      const updatedData = {
        ...formData,
        ingredientes: (formData.ingredientes || []).map((ing: any) => ({
          ...ing,
          nombre: normalizeIngredientName(ing.nombre),
          categoria: categorizeIngredient(ing.nombre)
        })),
        fotoURL: finalFotoURL,
        imageUrl: null, 
        updatedAt: serverTimestamp(),
      }

      const docRef = doc(db, "users", USER_ID, "recipes", recipeId);
      
      await updateDoc(docRef, updatedData)
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updatedData,
          });
          errorEmitter.emit('permission-error', permissionError);
          setIsSaving(false);
        });
      toast({ title: "¡Receta actualizada!" });
      router.push(`/recetas/${recipeId}`);

    } catch (e) {
      console.error("Error al guardar:", e)
      toast({ variant: "destructive", title: "Error al guardar" })
      setIsSaving(false)
    }
  }

  if (isLoading || !formData) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="font-black uppercase text-[10px] tracking-widest text-primary">Cargando editor...</p>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-black text-primary">Editar Receta</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl px-6 uppercase text-xs font-black">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
        </Button>
      </header>

      <div className="p-6 space-y-8 max-w-lg mx-auto w-full">
        <section className="space-y-4">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Foto del plato</label>
          <div 
            className="relative h-56 w-full rounded-[2.5rem] border-4 border-dashed border-primary/10 bg-primary-suave/30 overflow-hidden group cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            {imagePreview ? (
              <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized priority />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-primary/60">
                <ImageIcon className="h-12 w-12" />
                <span className="text-[10px] font-black uppercase tracking-widest">Toca para cargar foto</span>
              </div>
            )}
            <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Nombre del plato</label>
            <Input placeholder="Ej: Pasta Boloñesa" className="h-14 rounded-2xl border-2 font-bold text-lg" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Descripción</label>
            <Textarea placeholder="Contanos sobre este plato..." className="min-h-[100px] rounded-2xl border-2 font-medium" value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} />
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Categorías</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const isSelected = (formData.categorias || []).includes(cat)
              return (
                <Badge 
                  key={cat} 
                  variant={isSelected ? "default" : "secondary"}
                  className={`px-4 py-2 rounded-full cursor-pointer font-bold transition-all ${isSelected ? "bg-primary text-white" : "bg-primary-suave text-primary border-none"}`}
                  onClick={() => {
                    const current = formData.categorias || []
                    const next = isSelected ? current.filter((c: string) => c !== cat) : [...current, cat]
                    if (next.length > 0) setFormData({ ...formData, categorias: next })
                  }}
                >
                  {cat}
                </Badge>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase text-primary tracking-widest">Utensilios</h3>
          <div className="flex gap-2">
            <Input placeholder="Ej: Licuadora" className="rounded-xl" value={newUtensil} onChange={(e) => setNewUtensil(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setFormData({...formData, utensilios: [...formData.utensilios, newUtensil.trim()]}), setNewUtensil(""))} />
            <Button size="icon" onClick={() => (setFormData({...formData, utensilios: [...formData.utensilios, newUtensil.trim()]}), setNewUtensil(""))} className="rounded-xl"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.utensilios.map((u: string, i: number) => (
              <Badge key={i} variant="secondary" className="bg-primary-suave text-primary border-none gap-2 px-3 py-1.5 rounded-xl font-bold">
                <Wrench className="h-3 w-3" /> {u}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFormData({...formData, utensilios: formData.utensilios.filter((_:any, idx:number) => i !== idx)})} />
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Ingredientes</h3>
            <Button variant="ghost" size="sm" className="text-primary font-black text-[10px] uppercase" onClick={() => setFormData({...formData, ingredientes: [...formData.ingredientes, {nombre:"", cantidad:1, unidad:"unidad"}]})}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
          </div>
          {formData.ingredientes?.map((ing: any, i: number) => (
            <Card key={i} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden border-2 border-primary/5">
              <CardContent className="p-3 grid grid-cols-12 gap-2">
                <Input placeholder="Ingrediente" className="col-span-6 h-10 rounded-xl border-none bg-background/50 font-bold" value={ing.nombre} onChange={(e) => {
                  const n = [...formData.ingredientes]; n[i].nombre = e.target.value; setFormData({...formData, ingredientes: n});
                }} />
                <Input type="number" placeholder="Cant." className="col-span-3 h-10 rounded-xl border-none bg-background/50 font-bold" value={ing.cantidad} onChange={(e) => {
                  const n = [...formData.ingredientes]; n[i].cantidad = Number(e.target.value); setFormData({...formData, ingredientes: n});
                }} />
                <Input placeholder="Unid." className="col-span-2 h-10 rounded-xl border-none bg-background/50 px-2 font-bold" value={ing.unidad} onChange={(e) => {
                  const n = [...formData.ingredientes]; n[i].unidad = e.target.value; setFormData({...formData, ingredientes: n});
                }} />
                <Button variant="ghost" size="icon" className="col-span-1 h-10 w-10 text-destructive" onClick={() => setFormData({...formData, ingredientes: formData.ingredientes.filter((_:any, idx:number) => i !== idx)})}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
