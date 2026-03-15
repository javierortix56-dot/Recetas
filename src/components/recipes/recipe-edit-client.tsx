
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
import { useFirestore, useStorage } from "@/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { USER_ID } from "@/lib/constants"
import Image from "next/image"
import { normalizeIngredientName, categorizeIngredient } from "@/lib/categorizeIngredient"
import { useAppStore } from "@/store/app-store"

const CATEGORIES = ["Desayuno", "Almuerzo", "Cena", "Merienda", "Postre", "Snack"]

/**
 * Comprime una imagen en el cliente antes de subirla para mejorar la velocidad.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        }, 'image/jpeg', 0.85); // Calidad 85% para un balance ideal
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

export function RecipeEditClient({ recipeId }: { recipeId: string }) {
  const router = useRouter()
  const db = useFirestore()
  const storage = useStorage()
  
  const receta = useAppStore(s => s.recetas.find(r => r.id === recipeId))
  const recetasCargadas = useAppStore(s => s.recetasCargadas)
  const isLoading = !recetasCargadas

  const [formData, setFormData] = React.useState<any>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [newUtensil, setNewUtensil] = React.useState("")
  const [newTip, setNewTip] = React.useState("")

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
      setImagePreview(receta.fotoURL || receta.imageUrl || null)
    }
  }, [receta, formData])

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            toast({ title: "¡Imagen pegada! 📋" });
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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
      if (imageFile && storage) {
        toast({ title: "Procesando imagen...", description: "Comprimiendo y subiendo para mayor velocidad." })
        
        // 1. Comprimir en el cliente
        const compressedBlob = await compressImage(imageFile);
        
        // 2. Subir a Storage
        const timestamp = Date.now()
        const storageRef = ref(storage, `users/${USER_ID}/recipes/${recipeId}_${timestamp}.jpg`)
        const res = await uploadBytes(storageRef, compressedBlob)
        finalFotoURL = await getDownloadURL(res.ref)
      }

      // Limpiamos referencias duplicadas para consistencia
      const { imageUrl, ...restData } = formData;

      const updatedData = {
        ...restData,
        ingredientes: (formData.ingredientes || []).map((ing: any) => ({
          ...ing,
          nombre: normalizeIngredientName(ing.nombre),
          categoria: categorizeIngredient(ing.nombre)
        })),
        fotoURL: finalFotoURL,
        updatedAt: serverTimestamp(),
      }

      await updateDoc(doc(db, "users", USER_ID, "recipes", recipeId), updatedData)
      toast({ title: "¡Receta actualizada! 🎉" })
      
      // Pequeña pausa para asegurar sincronización antes de volver
      setTimeout(() => {
        router.push(`/recetas/${recipeId}`)
      }, 300)
    } catch (e) {
      console.error("Error al guardar:", e)
      toast({ variant: "destructive", title: "Error al guardar" })
      setIsSaving(false)
    }
  }

  const addIngrediente = () => {
    const newIng = { nombre: "", cantidad: 1, unidad: "unidad", preparacion: "" }
    setFormData({ ...formData, ingredientes: [...(formData.ingredientes || []), newIng] })
  }

  const updateIngrediente = (idx: number, field: string, value: any) => {
    const newIngs = [...formData.ingredientes]
    newIngs[idx] = { ...newIngs[idx], [field]: value }
    setFormData({ ...formData, ingredientes: newIngs })
  }

  const removeIngrediente = (idx: number) => {
    setFormData({ ...formData, ingredientes: formData.ingredientes.filter((_: any, i: number) => i !== idx) })
  }

  const addPaso = () => {
    const newPaso = { orden: (formData.pasos?.length || 0) + 1, titulo: "", descripcion: "", timerSegundos: 0 }
    setFormData({ ...formData, pasos: [...(formData.pasos || []), newPaso] })
  }

  const updatePaso = (idx: number, field: string, value: any) => {
    const newPasos = [...formData.pasos]
    newPasos[idx] = { ...newPasos[idx], [field]: value }
    setFormData({ ...formData, pasos: newPasos })
  }

  const removePaso = (idx: number) => {
    setFormData({ ...formData, pasos: formData.pasos.filter((_: any, i: number) => i !== idx) })
  }

  if (isLoading || !formData) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="font-black uppercase text-[10px] tracking-widest text-primary">Cargando...</p>
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
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Imagen del plato</label>
          <div 
            className="relative h-56 w-full rounded-[2.5rem] border-4 border-dashed border-primary/10 bg-primary-suave/30 overflow-hidden group cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => document.getElementById('image-upload')?.click()}
          >
            {imagePreview ? (
              <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized priority />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-primary/60">
                <ImageIcon className="h-12 w-12" />
                <span className="text-[10px] font-black uppercase tracking-widest">Subir o Pegar foto</span>
              </div>
            )}
            <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <p className="text-[9px] font-black text-muted-foreground text-center uppercase tracking-widest">Optimizado para cargas rápidas · Máx 10MB</p>
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
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Momentos del día</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const isSelected = (formData.categorias || []).includes(cat)
              return (
                <Badge 
                  key={cat} 
                  variant={isSelected ? "default" : "secondary"}
                  className={`px-4 py-2 rounded-full cursor-pointer font-bold ${isSelected ? "bg-primary text-white" : "bg-primary-suave text-primary border-none"}`}
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
            <Button variant="ghost" size="sm" className="text-primary font-black text-[10px] uppercase" onClick={addIngrediente}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
          </div>
          <div className="space-y-3">
            {formData.ingredientes?.map((ing: any, i: number) => (
              <Card key={i} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden border-2 border-primary/5">
                <CardContent className="p-3 grid grid-cols-12 gap-2">
                  <Input placeholder="Ingrediente" className="col-span-6 h-10 rounded-xl border-none bg-background/50 font-bold" value={ing.nombre} onChange={(e) => updateIngrediente(i, 'nombre', e.target.value)} />
                  <Input type="number" placeholder="Cant." className="col-span-3 h-10 rounded-xl border-none bg-background/50 font-bold" value={ing.cantidad} onChange={(e) => updateIngrediente(i, 'cantidad', Number(e.target.value))} />
                  <Input placeholder="Unid." className="col-span-2 h-10 rounded-xl border-none bg-background/50 px-2 font-bold" value={ing.unidad} onChange={(e) => updateIngrediente(i, 'unidad', e.target.value)} />
                  <Button variant="ghost" size="icon" className="col-span-1 h-10 w-10 text-destructive hover:bg-destructive/10" onClick={() => removeIngrediente(i)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Preparación</h3>
            <Button variant="ghost" size="sm" className="text-primary font-black text-[10px] uppercase" onClick={addPaso}><Plus className="h-3 w-3 mr-1" /> Agregar Paso</Button>
          </div>
          <div className="space-y-4">
            {formData.pasos?.map((paso: any, i: number) => (
              <Card key={i} className="rounded-3xl border-2 border-border/50 overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Paso {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removePaso(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input placeholder="Título del paso (opcional)" className="h-10 border-none font-bold p-0 text-primary" value={paso.titulo} onChange={(e) => updatePaso(i, 'titulo', e.target.value)} />
                  <Textarea placeholder="Instrucción detallada..." className="min-h-[80px] border-none p-0 text-sm font-medium" value={paso.descripcion} onChange={(e) => updatePaso(i, 'descripcion', e.target.value)} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
