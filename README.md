
# Cocina Familiar 🍳

Aplicación para la gestión de recetas familiares con **Server-Side Rendering (SSR)** y **Genkit AI**, desplegada en **Firebase App Hosting**.

## 🚀 Guía de Despliegue (App Hosting)

A diferencia del Hosting estático, App Hosting construye tu app en la nube directamente desde tu repositorio de GitHub.

### 1. Preparar tu Repositorio
Primero, asegúrate de que tu código esté en GitHub:
```bash
git add .
git commit -m "Preparado para App Hosting"
git push origin main
```

### 2. Crear el Backend en Firebase
Ejecuta este comando para vincular tu repo de GitHub con Firebase (o hazlo desde la sección **App Hosting** en la Consola de Firebase):
```bash
firebase apphosting:backends:create --project TU_ID_DE_PROYECTO
```
*Sigue las instrucciones para autorizar a GitHub y seleccionar este repositorio.*

### 3. ¡Listo!
Cada vez que hagas un `git push`, Firebase:
1. Detectará el cambio.
2. Ejecutará `npm run build` en sus servidores.
3. Desplegará la nueva versión con soporte completo para SSR (rutas dinámicas).

---

## 📱 Cómo abrir en tu móvil
Una vez desplegado, Firebase te dará una URL (ej: `https://tu-app.web.app`).
1. Abre el link en **Safari** (iOS) o **Chrome** (Android).
2. Selecciona **"Compartir"** o el menú de tres puntos.
3. Toca en **"Agregar a la pantalla de inicio"**.
4. La app se instalará como una **PWA** (Progressive Web App) con aspecto nativo.

## Desarrollo Local
```bash
npm run dev          # Iniciar servidor de desarrollo
npm run genkit:dev   # Iniciar herramientas de IA
```

