# Cocina Familiar — auditoría UX, velocidad y rediseño

Rediseño con el mismo sistema visual que Finanzas J&M (glass + fondo ambiental + motion),
limpieza de funciones duplicadas, corrección de bugs y mejoras de velocidad.
Se mantiene el verde como color de marca; el resto del lenguaje visual es el de Finanzas.

## 1. Velocidad

| # | Problema | Impacto | Corrección |
|---|----------|---------|------------|
| 1 | Todo el store (recetas con fotos en base64 incluidas) se serializaba en `localStorage` en **cada** snapshot de Firestore | Bloqueos del hilo principal; con muchas fotos se supera la cuota de 5 MB y el caché deja de funcionar sin aviso | Caché persistente de Firestore en IndexedDB (`persistentLocalCache`, multi-pestaña). En `localStorage` solo queda el perfil activo; el caché viejo se borra al primer arranque |
| 2 | `firebase/config.ts` inicializaba Firestore como efecto secundario | Impedía activar la caché persistente | `config.ts` solo exporta la configuración |
| 3 | Las 6 pestañas se montaban al abrir la app | Trabajo inicial innecesario y un sync de Compras con escrituras en cada apertura | Cada pestaña se monta la primera vez que se visita y después queda viva (conserva scroll y estado) |
| 4 | Las pestañas leían el store completo (`useAppStore()`) | Cualquier cambio (p. ej. tildar un ítem) re-renderizaba las 6 pestañas | Selectores con `useShallow` por pestaña |
| 5 | `AddMealPlanDialog` y `AddMealLogDialog` abrían cada uno su propio listener sobre toda la colección de recetas, una vez por instancia (4+ en Plan) | N descargas de todas las recetas con fotos | Usan las recetas del store |
| 6 | Detalle de receta: una consulta a Firestore por ingrediente para el semáforo de stock y otra tanda para "agregar faltantes" | 10–20 lecturas por apertura | Se calcula en memoria con la despensa del store |
| 7 | Importar recetas: una consulta por ingrediente + escrituras secuenciales | Importaciones lentas | Guardado en un solo `writeBatch` y chequeo de duplicados en memoria |
| 8 | Cada comida planificada copiaba la foto base64 de la receta | Documentos de plan pesados; el sync los relee todos | La foto ya no se copia; las vistas la toman de la receta |
| 9 | El sync leía **todo** el historial de planes | Lecturas crecientes con el tiempo | Solo planes desde hoy (`date >= hoy`) |
| 10 | El sync borraba y recreaba toda la lista de compras en cada cambio | Parpadeo y escrituras innecesarias | Reconciliación: actualiza, crea o borra solo lo que cambió |
| 11 | Despensa y Compras montaban un diálogo de edición por cada fila | Cientos de componentes y efectos montados | Un único diálogo controlado por lista |
| 12 | `recharts` para 5 gráficos de 7 puntos | ~100 KB de JS | Barras SVG/CSS propias (`WeekBars`) |
| 13 | Fuente Inter vía `<link>` a Google Fonts | Bloqueaba el primer render | `next/font` (se sirve desde el propio dominio) |
| 14 | Escrituras que esperaban el sync antes de cerrar el diálogo | Sensación de lentitud | El sync corre en segundo plano |

**Medido** (`next build`, JS que descarga la pantalla de inicio, gzip): **458 KB → 367 KB (−20 %)**.

## 2. Bugs corregidos

| # | Problema | Corrección |
|---|----------|------------|
| 1 | "Nueva receta" no permitía cargar ingredientes, pasos, macros, porciones ni tiempos (la pantalla estaba a medio hacer) | Formulario único `RecipeForm` para crear y editar, completo |
| 2 | "Editar receta" no permitía editar pasos, macros, porciones, tiempos ni tips | Mismo `RecipeForm` |
| 3 | Pestaña **Costo** del detalle sin contenido | Costo total y por porción con los precios de la despensa |
| 4 | Modo cocina: el primer toque del temporizador solo lo cargaba; había que tocar dos veces | Un toque lo inicia; además reiniciar, vibración al terminar y pantalla siempre encendida (Wake Lock) |
| 5 | La lista de compras es compartida, pero el sync solo usaba los planes del perfil activo | Si Mary planificaba, desaparecían de la lista los ingredientes del plan de Javi. Ahora suma los planes de ambos perfiles |
| 6 | Cualquier cambio en el plan destildaba todo el carrito (borrado y recreación) | Los ítems que siguen en la lista conservan su estado |
| 7 | Registrar una comida de N porciones sumaba N porciones al resumen pero al borrarla restaba 1 | El registro guarda el total consumido |
| 8 | Los resúmenes de "planear semana" no tenían campo `date`: Inicio y Nutrición no los encontraban | Se escribe `date` y se lee también desde el id `fecha_perfil` |
| 9 | El botón para cargar precio en Compras solo aparecía con *hover* (invisible en el celular) | Se toca el precio ("$ —") |
| 10 | En el detalle de receta la barra de acciones quedaba encima del menú inferior | El menú se oculta en las subpáginas |
| 11 | `manifest` apuntaba a `/manifest.json` (404) | `/manifest.webmanifest`, generado por Next |
| 12 | Modo selección en Recetas sin ninguna acción | Ahora permite eliminar varias |
| 13 | Archivo `generate-smart-shopping-list.ts` truncado (no compilaba) | Eliminado (no se usaba; el MRP vive en `sync-logic.ts`) |

## 3. Menús y funciones duplicadas

| Antes | Ahora |
|-------|-------|
| Recetas › ⋮: "Prompt IA" (sheet) **y** "Importar JSON" (modal con el mismo prompt): había que copiar el prompt a otra IA y pegar el JSON | **Crear con IA** dentro de la app: se escribe qué cocinar, Gemini arma la receta y genera la foto |
| Despensa: modo "Seleccionar" + diálogo "Mover productos" **y** "Gestionar categorías" (que también mueve productos) | Solo **Gestionar categorías** |
| "Limpieza de despensa" (unificar duplicados) escondida en los ajustes de Nutrición | En el menú de **Despensa** |
| Compras: "Borrar todos manuales" **y** "Seleccionar manuales" (con "Todos") | Solo la selección |
| Compras: deslizar para borrar en todos los ítems, incluso los del plan (que el sync vuelve a crear) | Solo en ítems agregados a mano |
| Detalle: "Agregar faltantes a Compras" creaba ítems manuales que duplicaban los del plan | Eliminado: al planificar, los faltantes entran solos |
| Tres implementaciones distintas del anillo de macros (Inicio, Plan, Nutrición) | Un componente `MacroRing` |
| Lógica de "plan + log + resumen" copiada en 3 lugares | `lib/meal-plan.ts` |
| Selector de perfil fijo arriba de todas las pestañas, incluso las compartidas | Solo en Inicio, Plan y Nutrición (las que dependen del perfil) |
| `contextual-fab-sheet`, `edit-recipe-client`, `cooking-mode-client`, `PlanCell`, `PlanColumn`, `profile-selection-overlay` y 14 componentes UI sin uso | Eliminados |

### Mapa de navegación resultante

- **Inicio** (perfil, ajustes): héroe de nutrición → Nutrición · plan de hoy · por comprar / stock bajo · calorías de la semana · gasto.
  - **Ajustes**: metas de macros por perfil y tema (sistema/claro/oscuro).
  - **Nutrición** (perfil): Día / Semana · "Comida fuera del plan".
- **Plan** (perfil) › ⋯: Planificar semana con IA · Vaciar semana. Por día: "Armar día" con IA, agregar por momento, porciones ±, quitar.
- **Recetas** › ⋯: Escribir a mano · Seleccionar varias. ✨ Crear con IA (pedido en texto → receta + foto).
  - **Detalle** › ⋯: Editar · Generar foto con IA · Registrar que la comí · Eliminar. Barra: Planificar · Cocinar.
- **Despensa** › ⋯: Expandir/contraer · Historial · Gestionar categorías · Unificar duplicados con IA · Mínimos en 0. `+` nuevo producto.
- **Compras** › ⋯: Recalcular con el plan · Expandir/contraer · Borrar agregados a mano. `+` agregar producto.

## 4. Sistema visual (de Finanzas J&M)

- Tokens HSL con modo oscuro por sistema o manual (`data-theme`), sin parpadeo (script de arranque).
- Superficies `glass` / `glass-strong` / `sheet-surface`, `bg-brand`, `eyebrow`, `hit-44`, skeleton con brillo.
- Fondo ambiental animado (respeta `prefers-reduced-motion` y `prefers-reduced-transparency`).
- Dock flotante con etiquetas, indicador con `layoutId` y badge de pendientes en Compras.
- Encabezados "large title" (`PageHeader`), botones redondos glass (`HeaderButton`), `Segmented`, `FilterChip`, `EmptyState`.
- Todos los diálogos pasan a ser bottom sheets con asa y safe-area; confirmaciones como tarjeta glass.
- Presets de motion compartidos (`components/ui/motion.ts`).

## 5. Recetas con IA

- `src/ai/flows/generate-recipe-flow.ts`: dos server actions con Genkit.
  - `generateRecipe`: modelo de texto (`GEMINI_TEXT_MODEL`, por defecto `gemini-2.5-flash-lite`, con capa gratuita) con salida estructurada (esquema Zod con las unidades y categorías de la app) y las reglas de cocina de `lib/recipe-prompt.ts`.
  - `generateRecipeImage`: modelo de imagen (`GEMINI_IMAGE_MODEL`, por defecto `gemini-2.5-flash-image`, solo con facturación activa, ≈ US$0,039 por imagen); el cliente la comprime a JPEG de 700 px antes de guardarla.
- Requiere `GEMINI_API_KEY` en Vercel (Production y Preview). La generación de imágenes puede requerir facturación activa en Google AI Studio (el nivel gratuito de la API no siempre la incluye). Si falla, la receta se guarda igual sin foto.
- `maxDuration = 60` en el layout para que las llamadas no corten por tiempo.

## 6. Fotos en Vercel Blob

- Las fotos ya no se guardan como base64 dentro del documento de la receta: se suben a Vercel Blob (tienda `recetas-fotos`, pública, región iad1) y en `fotoURL` queda solo la URL. El listener de recetas deja de descargar todas las fotos en cada arranque.
- `src/app/actions/recipe-images.ts`: server actions `uploadRecipeImage` (valida tipo JPEG/PNG/WebP y máx. 1,5 MB) y `deleteRecipeImage` (ignora URLs que no son de la tienda).
- Se sube desde: formulario de receta, "Crear con IA" y "Generar foto con IA". Al reemplazar una foto o borrar una receta (individual o en lote) se borra la anterior.
- Recetas existentes: **Recetas › ⋯ › Mover N fotos a la nube** sube las que siguen en base64 y quita las copias que los planes viejos guardaban de esas fotos. Es idempotente y no toca nada si una subida falla.
- Requiere `BLOB_READ_WRITE_TOKEN` (la agrega Vercel al conectar la tienda al proyecto). Las URLs son públicas pero con sufijo aleatorio imposible de adivinar.
- Sin conexión: la app ya no tiene las fotos dentro de los datos cacheados; el navegador las cachea por su cuenta (cabecera de caché de 1 año).

## 7. Precios de supermercados

Fuentes verificadas el 30/10/2026 (todas públicas y sin clave; no son APIs con contrato, pueden cambiar sin aviso):

| Fuente | Endpoint | Búsqueda | Por código de barras |
|---|---|---|---|
| Carrefour, Día, Jumbo, Vea, ChangoMás | VTEX `/api/catalog_system/pub/products/search` | `ft=` | `fq=alternateIds_Ean:` |
| Coto | `coto.com.ar/sitios/cdigi/categoria?Ntt=…&format=json` | `Ntt=` | por nombre + filtro por código (también trae el precio por kg/l) |
| Precios Claros (SEPA) | endpoint web | — | — |

Precios Claros **no se usa**: su endpoint web no acepta pedidos de terceros y no corresponde simular su sitio. La vía oficial son los datos abiertos SEPA (archivos diarios en datos.produccion.gob.ar, CC BY 4.0), que requieren un proceso de importación aparte.

- `src/app/actions/prices.ts`: `searchPrices(texto)` consulta las 6 fuentes en paralelo (8 s de tiempo máximo por fuente; si una falla, siguen las demás). `refreshPrices(refs)` vuelve a consultar productos vinculados por código de barras.
- `src/lib/prices/types.ts`: interpreta el tamaño del envase ("500 Gr.", "1,5 L", "x kg", "x 12") y convierte a la unidad de la despensa ($/kg, $/l, $/unidad, $/docena).
- Despensa › producto › **Buscar precio en supermercados**: se eligen uno o varios productos (los que tienen el mismo código en otros súper se marcan juntos) y se guarda el **promedio** por unidad base. Los elegidos quedan vinculados en `fuentesPrecio`.
- Despensa › ⋯ › **Actualizar N precios**: recalcula el promedio de todos los productos vinculados (de a 3 en paralelo). Si ninguna fuente responde, se conserva el precio anterior. Después se recalcula la lista de compras.
- Editar el precio a mano desvincula el producto (el precio manual no se pisa).

## 8. Propuestas (no implementadas)

1. ~~Fotos fuera de las recetas~~ → hecho, ver sección 6.
2. **Precios Claros vía datos abiertos SEPA**: importar semanalmente los precios de sucursales de CABA desde los archivos oficiales como fuente adicional.
2. **Reglas de Firestore**: hoy no hay autenticación (usuario fijo `usuario-local`); conviene Auth + reglas por familia.
3. **Migrar a Neon (Postgres)**: pendiente por decisión. Implica perder la sincronización en vivo y el modo sin conexión de Firestore, y mover las fotos a un almacenamiento de archivos (p. ej. Vercel Blob).
4. **Deshacer** al borrar (como en Finanzas) en vez de diálogos de confirmación.
5. **Lista de compras por pasillo** con orden configurable del súper.
6. **Exportar/compartir** la lista de compras por WhatsApp.
