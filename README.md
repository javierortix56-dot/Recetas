
# Cocina Familiar 🍳

Aplicación para la gestión de recetas familiares con **Server-Side Rendering (SSR)** y **Genkit AI**, desplegada en **Firebase App Hosting**.

## 🚀 Guía de Despliegue (App Hosting)

A diferencia del Hosting estático tradicional, App Hosting construye tu app en la nube directamente desde tu repositorio de GitHub.

### 1. Limpiar archivos pesados (Solo la primera vez)
Si Git te da errores de archivos de más de 100MB, ejecuta estos comandos en tu terminal para limpiar la caché:
```bash
git rm -r --cached .
git add .
git commit -m "Limpieza de caché y archivos ignorados"
```

### 2. Vincular con Firebase
Si aún no has creado el backend en Firebase, ejecuta:
```bash
firebase apphosting:backends:create --project TU_ID_DE_PROYECTO
```
*Sigue las instrucciones para autorizar a GitHub y seleccionar este repositorio.*

### 3. ¡Desplegar!
Para cualquier cambio futuro, simplemente haz un push a tu rama principal:
```bash
git add .
git commit -m "Descripción de mis cambios"
git push origin main
```
Firebase detectará el cambio automáticamente, ejecutará `npm run build` en sus servidores y desplegará la nueva versión.

---

## 📱 Instalación como PWA
Una vez desplegado, abre la URL en tu móvil:
1. **iOS (Safari)**: Toca el botón "Compartir" -> "Agregar a la pantalla de inicio".
2. **Android (Chrome)**: Toca los tres puntos -> "Instalar aplicación".

## Desarrollo Local
```bash
npm run dev          # Iniciar servidor de Next.js
npm run genkit:dev   # Iniciar herramientas de IA
```
