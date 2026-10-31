"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Plus, Trash2, Camera, Loader2, X, ChevronUp, ChevronDown } from "lucide-react"
import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Segmented } from "@/components/ui/segmented"
import { useFirestore } from "@/firebase"
import { toast } from "@/hooks/use-toast"
import { USER_ID } from "@/lib/constants"
import { cn, getSafeImageSource } from "@/lib/utils"
import { uploadImageSrc } from "@/lib/recipe-image"
import { deleteRecipeImage } from "@/app/actions/recipe-images"
import { cleanRecipeIngredients, missingPantryItems } from "@/lib/ingredient-groups"
import { useAppStore } from "@/store/app-store"

const CATEGORIES = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Postre", "Snack"]
const UNITS = ["g", "kg", "ml", "l", "unidad", "cucharada", "cucharadita", "taza", "docena"]
const DIFICULTADES = ["Fácil", "Media", "Difícil"] as const

const EMPTY = {
  nombre: "",
  descripcion: "",
  historia: "",
  categorias: ["Almuerzo"],
  porciones: 3,
  tiempoPreparacion: 15,
  tiempoCoccion: 30,
  dificultad: "Media",
  utensilios: [] as string[],
  tips: [] as string[],
  tags: [] as string[],
  macros: { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  ingredientes: [] as any[],
  pasos: [] as any[],
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow px-1 flex items-center gap-1.5">{label}{hint && <span className="normal-case tracking-normal font-medium text-muted-foreground/70">{hint}</span>}</span>
      {children}
    </label>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-[24px] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Lista de textos cortos (utensilios, tips, tags) con alta por Enter */
function ChipList({ items, onChange, placeholder, multiline }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; multiline?: boolean }) {
  const [value, setValue] = React.useState("")
  const add = () => {
    const v = value.trim()
    if (!v) return
    onChange([...items, v])
    setValue("")
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {multiline ? (
          <Textarea value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className="min-h-[44px]" />
        ) : (
          <Input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }} />
        )}
        <Button type="button" size="icon" variant="secondary" className="shrink-0 h-11 w-11" onClick={add} aria-label="Agregar"><Plus className="h-4 w-4" /></Button>
      </div>
      {items.length > 0 && (
        <div className={cn(multiline ? "space-y-1.5" : "flex flex-wrap gap-1.5")}>
          {items.map((it, i) => (
            <span key={i} className={cn("flex items-center gap-1.5 bg-foreground/[0.05] text-sm", multiline ? "rounded-2xl px-3 py-2 justify-between" : "rounded-full pl-3 pr-1.5 h-8")}>
              <span className={cn(multiline && "flex-1")}>{it}</span>
              <button type="button" aria-label="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))} className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Formulario único para crear y editar recetas. Reemplaza dos pantallas que
 * estaban incompletas: "Nueva" no permitía cargar ingredientes ni pasos, y
 * "Editar" no permitía editar pasos, macros, porciones ni tiempos.
 */
export function RecipeForm({ recipe }: { recipe?: any }) {
  const router = useRouter()
  const db = useFirestore()
  const isEdit = !!recipe?.id

  const [form, setForm] = React.useState(() => recipe ? {
    ...EMPTY,
    ...recipe,
    categorias: Array.isArray(recipe.categorias) && recipe.categorias.length ? recipe.categorias : [recipe.categoria || "Almuerzo"],
    macros: { ...EMPTY.macros, ...(recipe.macros || {}) },
    utensilios: recipe.utensilios || [],
    tips: recipe.tips || [],
    tags: recipe.tags || [],
    ingredientes: recipe.ingredientes || [],
    pasos: recipe.pasos || [],
  } : EMPTY)
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(recipe ? getSafeImageSource(recipe) : null)
  const [isSaving, setIsSaving] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof EMPTY>(key: K, value: any) => setForm((f: any) => ({ ...f, [key]: value }))
  const setIng = (i: number, patch: any) => set("ingredientes", form.ingredientes.map((ing: any, j: number) => j === i ? { ...ing, ...patch } : ing))
  const setStep = (i: number, patch: any) => set("pasos", form.pasos.map((p: any, j: number) => j === i ? { ...p, ...patch } : p))
  const moveStep = (i: number, delta: number) => {
    const next = [...form.pasos]
    const j = i + delta
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set("pasos", next)
  }
  const toggleCategory = (cat: string) => {
    const has = form.categorias.includes(cat)
    const next = has ? form.categorias.filter((c: string) => c !== cat) : [...form.categorias, cat]
    if (next.length) set("categorias", next)
  }

  const handleSave = async () => {
    if (!db) return
    if (!form.nombre.trim()) {
      toast({ variant: "destructive", title: "Falta el nombre" })
      return
    }
    setIsSaving(true)
    const pantry = useAppStore.getState().ingredientes
    try {
      const previousUrl = recipe?.fotoURL || recipe?.imageUrl || null
      let fotoURL = previousUrl
      if (imageFile) {
        // Foto nueva: va a Blob (no dentro del documento) y se borra la anterior
        fotoURL = await uploadImageSrc(URL.createObjectURL(imageFile))
        if (previousUrl) deleteRecipeImage(previousUrl)
      }

      const data = {
        ...form,
        nombre: form.nombre.trim(),
        categoria: form.categorias[0],
        porciones: Math.max(1, Number(form.porciones) || 1),
        tiempoPreparacion: Number(form.tiempoPreparacion) || 0,
        tiempoCoccion: Number(form.tiempoCoccion) || 0,
        macros: {
          calorias: Number(form.macros.calorias) || 0,
          proteinas: Number(form.macros.proteinas) || 0,
          carbohidratos: Number(form.macros.carbohidratos) || 0,
          grasas: Number(form.macros.grasas) || 0,
        },
        ingredientes: cleanRecipeIngredients(form.ingredientes, pantry),
        pasos: form.pasos
          .filter((p: any) => (p.descripcion || p.titulo || "").trim())
          .map((p: any, i: number) => ({ ...p, orden: i + 1, timerSegundos: Number(p.timerSegundos) || 0 })),
        fotoURL,
        imageUrl: null,
        userId: USER_ID,
        updatedAt: serverTimestamp(),
      }
      delete (data as any).id

      // Ingredientes nuevos a la despensa (con stock 0): sin esto no entraban a la lista de compras
      const nuevos = missingPantryItems(data.ingredientes, pantry)
      if (nuevos.length) {
        const batch = writeBatch(db)
        nuevos.forEach(ing => batch.set(doc(collection(db, "users", USER_ID, "ingredients")), {
          ...ing, stockActual: 0, stockMinimo: 0, userId: USER_ID, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }))
        await batch.commit()
      }

      if (isEdit) {
        await updateDoc(doc(db, "users", USER_ID, "recipes", recipe.id), data)
        toast({ title: "Receta actualizada ✓" })
        router.replace(`/recetas/${recipe.id}`)
      } else {
        const ref = await addDoc(collection(db, "users", USER_ID, "recipes"), { ...data, createdAt: serverTimestamp() })
        toast({ title: "Receta creada 🎉" })
        router.replace(`/recetas/${ref.id}`)
      }
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "No se pudo guardar" })
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-32">
      <header className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-background/70 backdrop-blur-xl flex items-center justify-between gap-3">
        <button aria-label="Volver" onClick={() => router.back()} className="h-9 w-9 rounded-full glass flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
        <h1 className="text-[17px] font-bold tracking-tight truncate">{isEdit ? "Editar receta" : "Nueva receta"}</h1>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
      </header>

      <div className="px-4 space-y-4">
        {/* Foto */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-full h-52 rounded-[24px] overflow-hidden glass flex items-center justify-center active:scale-[0.99] transition-transform"
        >
          {imagePreview ? (
            <>
              <Image src={imagePreview} alt="Foto del plato" fill className="object-cover" unoptimized />
              <span className="absolute bottom-3 right-3 h-9 px-3 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Cambiar</span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="h-8 w-8" />
              <span className="text-xs font-semibold">Agregar foto</span>
            </span>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)) }
          }} />
        </button>

        <Section title="Datos básicos">
          <Field label="Nombre"><Input value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Tallarines a la boloñesa" /></Field>
          <Field label="Descripción"><Textarea value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Sabor, textura, ocasión ideal" /></Field>
          <Field label="Momentos">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)} className={cn("h-8 px-3 rounded-full text-xs font-semibold transition-colors", form.categorias.includes(cat) ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-muted-foreground")}>
                  {cat}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Dificultad">
            <Segmented id="form-dificultad" value={form.dificultad} onChange={(v) => set("dificultad", v)} options={DIFICULTADES.map(d => ({ value: d, label: d }))} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Porciones"><Input type="number" inputMode="numeric" min={1} value={form.porciones} onChange={e => set("porciones", e.target.value)} /></Field>
            <Field label="Prep." hint="min"><Input type="number" inputMode="numeric" min={0} value={form.tiempoPreparacion} onChange={e => set("tiempoPreparacion", e.target.value)} /></Field>
            <Field label="Cocción" hint="min"><Input type="number" inputMode="numeric" min={0} value={form.tiempoCoccion} onChange={e => set("tiempoCoccion", e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Macros por porción">
          <div className="grid grid-cols-4 gap-2">
            {([["calorias", "Kcal"], ["proteinas", "Prot g"], ["carbohidratos", "Carb g"], ["grasas", "Grasa g"]] as const).map(([k, label]) => (
              <Field key={k} label={label}>
                <Input type="number" inputMode="decimal" min={0} className="px-2 text-center" value={form.macros[k]} onChange={e => set("macros", { ...form.macros, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Section>

        <Section
          title={`Ingredientes (${form.ingredientes.length})`}
          action={<Button type="button" size="sm" variant="secondary" onClick={() => set("ingredientes", [...form.ingredientes, { nombre: "", cantidad: 1, unidad: "unidad", preparacion: "" }])}><Plus className="h-4 w-4" /> Agregar</Button>}
        >
          {form.ingredientes.length === 0 && <p className="text-sm text-muted-foreground">Cantidades exactas para {form.porciones} porciones.</p>}
          {form.ingredientes.map((ing: any, i: number) => (
            <div key={i} className="rounded-2xl bg-foreground/[0.03] p-2 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Ingrediente" value={ing.nombre} onChange={e => setIng(i, { nombre: e.target.value })} className="flex-1" />
                <button type="button" aria-label="Quitar ingrediente" onClick={() => set("ingredientes", form.ingredientes.filter((_: any, j: number) => j !== i))} className="h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-[1fr_1.2fr_2fr] gap-2">
                <Input type="number" inputMode="decimal" min={0} placeholder="Cant." value={ing.cantidad} onChange={e => setIng(i, { cantidad: e.target.value })} className="px-2 text-center" />
                <select value={ing.unidad} onChange={e => setIng(i, { unidad: e.target.value })} className="h-11 rounded-2xl bg-foreground/[0.05] px-2 text-sm outline-none focus:ring-4 focus:ring-primary/10">
                  {[...new Set([...UNITS, ing.unidad].filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <Input placeholder="Preparación (opcional)" value={ing.preparacion || ""} onChange={e => setIng(i, { preparacion: e.target.value })} />
              </div>
            </div>
          ))}
        </Section>

        <Section
          title={`Pasos (${form.pasos.length})`}
          action={<Button type="button" size="sm" variant="secondary" onClick={() => set("pasos", [...form.pasos, { titulo: "", descripcion: "", timerSegundos: 0 }])}><Plus className="h-4 w-4" /> Agregar</Button>}
        >
          {form.pasos.map((p: any, i: number) => (
            <div key={i} className="rounded-2xl bg-foreground/[0.03] p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 shrink-0 rounded-xl bg-brand text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                <Input placeholder="Título (ej: Sellar la carne)" value={p.titulo || ""} onChange={e => setStep(i, { titulo: e.target.value })} className="flex-1" />
                <div className="flex flex-col">
                  <button type="button" aria-label="Subir paso" disabled={i === 0} onClick={() => moveStep(i, -1)} className="h-5 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Bajar paso" disabled={i === form.pasos.length - 1} onClick={() => moveStep(i, 1)} className="h-5 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>
              <Textarea placeholder="Qué hacer, a qué fuego y qué señal esperar" value={p.descripcion || ""} onChange={e => setStep(i, { descripcion: e.target.value })} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Temporizador</span>
                <Input type="number" inputMode="numeric" min={0} value={Math.round((Number(p.timerSegundos) || 0) / 60)} onChange={e => setStep(i, { timerSegundos: (Number(e.target.value) || 0) * 60 })} className="w-20 h-9 px-2 text-center" />
                <span className="text-xs text-muted-foreground">min</span>
                <button type="button" aria-label="Quitar paso" onClick={() => set("pasos", form.pasos.filter((_: any, j: number) => j !== i))} className="ml-auto h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Utensilios"><ChipList items={form.utensilios} onChange={v => set("utensilios", v)} placeholder="Ej: Sartén de hierro" /></Section>
        <Section title="Tips del chef"><ChipList items={form.tips} onChange={v => set("tips", v)} placeholder="Consejo técnico" multiline /></Section>
        <Section title="Tags"><ChipList items={form.tags} onChange={v => set("tags", v.map(t => t.toLowerCase()))} placeholder="Ej: italiana, rápida" /></Section>
        <Section title="Historia"><Textarea value={form.historia || ""} onChange={e => set("historia", e.target.value)} placeholder="Origen o dato curioso (opcional)" /></Section>
      </div>
    </div>
  )
}
