"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, X, Image as ImageIcon, Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useStorage } from "@/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { USER_ID } from "@/lib/constants"
import Image from "next/image"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { normalizeIngredientName } from "@/lib/categorizeIngredient"

const CATEGORIES = ["Desayuno", "Almuerzo", "Cena", "Merienda", "Postre", "Snack"]

export default function NewRecipePage() {
  const router = useRouter()
  const db = useFirestore()
  const storage = useStorage()
  
  const [formData, setFormData] = React.useState<any>({
    nombre: "",
    descripcion: "",
    historia: "",
    categoria: "Almuerzo",
    categorias: ["Almuerzo"],
    porciones: 3,
    tiempoPreparacion: 15,
    tiempoCoccion: 30,
    dificultad: "Media",
    utensilios: [],
    tags: [],
    consejoChef: "",
    macros: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, azucar: 0, sodio: 0 },
    ingredientes: [],
    pasos: []
  })

  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [newTag, setNewTag] = React.useState("")

  // Soporte para PEGAR imágenes desde el portapapeles
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              toast({ variant: "destructive", title: "Imagen muy pesada", description: "El límite es 5MB." });
              continue;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            toast({ title: "¡Imagen pegada! 📋", description: "Se ha cargado la imagen del portapapeles." });
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
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Imagen muy pesada", description: "El límite es 5MB." })
        return
      }
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!formData.nombre || !db) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El nombre es obligatorio." })
      return
    }

    setIsSaving(true)
    let finalFotoURL = null

    try {
      if (imageFile && storage) {
        toast({ title: "Subiendo imagen...", description: "Por favor espera un momento." });
        try {
          const timestamp = Date.now()
          const storageRef = ref(storage, `users/${USER_ID}/recipes/new_${timestamp}`)
          
          const uploadPromise = uploadBytes(storageRef, imageFile).then(res => getDownloadURL(res.ref));
          const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve(null), 15000)
          );

          const storageResult = await Promise.race([uploadPromise, timeoutPromise]);
          
          if (storageResult) {
            finalFotoURL = storageResult as string;
          } else {
            toast({ 
              variant: "destructive", 
              title: "Imagen omitida", 
              description: "La subida tardó demasiado. Se guardará sin foto." 
            })
          }
        } catch (storageError: any) {
          console.error("Error en Storage:", storageError)
          toast({ 
            variant: "destructive", 
            title: "Error de imagen", 
            description: "No se pudo subir la foto. Guardando solo texto..." 
          })
        }
      }

      const ingredientesNormalizados = (formData.ingredientes || []).map((ing: any) => ({
        ...ing,
        nombre: normalizeIngredientName(ing.nombre)
      }));

      const { imageUrl, ...restFormData } = formData;

      const recipeData = {
        ...restFormData,
        ingredientes: ingredientesNormalizados,
        categoria: formData.categorias[0] || "Almuerzo",
        userId: USER_ID,
        fotoURL: finalFotoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const recipesCol = collection(db, "users", USER_ID, "recipes");
      
      addDoc(recipesCol, recipeData)
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: recipesCol.path,
            operation: 'create',
            requestResourceData: recipeData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      toast({ title: "¡Receta creada! 🎉" })
      router.push("/recetas")
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error fatal", description: "No se pudo iniciar el guardado." })
      setIsSaving(false)
    }
  }

  const toggleCategoria = (cat: string) => {
    const current = formData.categorias || ["Almuerzo"]
    const next = current.includes(cat)
      ? current.filter((c: string) => c !== cat)
      : [...current, cat]
    
    if (next.length === 0) return
    setFormData({ ...formData, categorias: next })
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim().toLowerCase())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim().toLowerCase()] })
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tag) })
  }

  const addIngrediente = () => {
    const newIng = { nombre: "", cantidad: 1, unidad: "unidad", preparacion: "" }
    setFormData({ ...formData, ingredientes: [...formData.ingredientes, newIng] })
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
    const newPaso = { 
      orden: formData.pasos.length + 1, 
      titulo: "", 
      descripcion: "", 
      timerSegundos: 0 
    }
    setFormData({ ...formData, pasos: [...formData.pasos, newPaso] })
  }

  const updatePaso = (idx: number, field: string, value: any) => {
    const newPasos = [...formData.pasos]
    newPasos[idx] = { ...newPasos[idx], [field]: value }
    setFormData({ ...formData, pasos: newPasos })
  }

  const removePaso = (idx: number) => {
    setFormData({ ...formData, pasos: formData.pasos.filter((_: any, i: number) => i !== idx) })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background animate-in fade-in duration-500 pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-black text-primary">Nueva Receta</h1>
        </div>
        <Button 
          className="bg-primary text-white rounded-2xl h-10 px-6 font-black uppercase text-xs shadow-lg"
          onClick={handleSave}
          disabled={isSaving}
        >
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
              <Image src={imagePreview} alt="Preview" fill className="object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-primary/60">
                <Camera className="h-12 w-12" />
                <span className="text-[10px] font-black uppercase tracking-widest">Subir o Pegar Imagen</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImageIcon className="text-white h-10 w-10" />
            </div>
            <input 
              id="image-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageChange} 
            />
          </div>
          <p className="text-[9px] font-black text-muted-foreground text-center uppercase tracking-[0.2em]">Máximo 5MB · PNG, JPG · <span className="text-primary">Podés pegar con Ctrl+V</span></p>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Nombre del plato</label>
            <Input 
              placeholder="Ej: Pasta Boloñesa" 
              className="h-14 rounded-2xl border-2 font-bold text-lg focus-visible:ring-primary"
              value={formData.nombre}
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Descripción</label>
            <Textarea 
              placeholder="Contanos un poco sobre este plato..." 
              className="min-h-[100px] rounded-2xl border-2 font-medium focus-visible:ring-primary"
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
            />
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
                  className={`px-4 py-2 rounded-full cursor-pointer font-bold transition-all ${isSelected ? "bg-primary text-white shadow-md" : "bg-primary-suave text-primary border-none"}`}
                  onClick={() => toggleCategoria(cat)}
                >
                  {cat}
                </Badge>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Tags / Etiquetas</label>
          <div className="flex gap-2 mb-3">
            <Input 
              placeholder="Añadir tag (ej: saludable)" 
              className="h-10 rounded-xl bg-background/50 border-none font-bold"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
            <Button size="icon" onClick={addTag} className="rounded-xl shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags?.map((tag: string) => (
              <Badge key={tag} className="bg-primary-suave text-primary border-none px-3 py-1.5 rounded-xl gap-1 font-bold uppercase text-[10px]">
                #{tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Ingredientes</h3>
            <Button variant="ghost" size="sm" className="text-primary font-black text-[10px] uppercase" onClick={addIngrediente}>
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
          </div>
          <div className="space-y-3">
            {formData.ingredientes.map((ing: any, i: number) => (
              <Card key={i} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden border-2 border-primary/5">
                <CardContent className="p-3 grid grid-cols-12 gap-2">
                  <Input 
                    placeholder="Ingrediente" 
                    className="col-span-6 h-10 rounded-xl border-none bg-background/50 font-bold"
                    value={ing.nombre}
                    onChange={(e) => updateIngrediente(i, 'nombre', e.target.value)}
                  />
                  <Input 
                    type="number"
                    placeholder="Cant." 
                    className="col-span-3 h-10 rounded-xl border-none bg-background/50 font-bold"
                    value={ing.cantidad}
                    onChange={(e) => updateIngrediente(i, 'cantidad', Number(e.target.value))}
                  />
                  <Input 
                    placeholder="Unid." 
                    className="col-span-2 h-10 rounded-xl border-none bg-background/50 px-2 font-bold"
                    value={ing.unidad}
                    onChange={(e) => updateIngrediente(i, 'unidad', e.target.value)}
                  />
                  <Button variant="ghost" size="icon" className="col-span-1 h-10 w-10 text-destructive" onClick={() => removeIngrediente(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Preparación</h3>
            <Button variant="ghost" size="sm" className="text-primary font-black text-[10px] uppercase" onClick={addPaso}>
              <Plus className="h-3 w-3 mr-1" /> Agregar Paso
            </Button>
          </div>
          <div className="space-y-4">
            {formData.pasos.map((paso: any, i: number) => (
              <Card key={i} className="rounded-3xl border-2 border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Paso {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePaso(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input 
                    placeholder="Título (opcional)" 
                    className="h-10 border-none font-bold p-0 focus-visible:ring-0 text-primary"
                    value={paso.titulo}
                    onChange={(e) => updatePaso(i, 'titulo', e.target.value)}
                  />
                  <Textarea 
                    placeholder="Explicación detallada..." 
                    className="min-h-[80px] border-none p-0 focus-visible:ring-0 text-sm font-medium"
                    value={paso.descripcion}
                    onChange={(e) => updatePaso(i, 'descripcion', e.target.value)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-border z-50 safe-area-pb max-w-lg mx-auto">
        <Button 
          className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] shadow-lg"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Creando..." : "Crear Receta"}
        </Button>
      </div>
    </div>
  )
}
