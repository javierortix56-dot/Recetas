
# Cocina Familiar 🍳

Aplicación para la gestión de recetas familiares, inventario y nutrición con **Next.js (App Router)**, **Genkit AI** y **Firebase**.

## 🚀 Guía de Despliegue (Firebase App Hosting)

Firebase App Hosting es la nueva generación de hosting que soporta Server-Side Rendering (SSR) automáticamente a través de GitHub.

### 1. Requisitos previos
- Tener instalada la [Firebase CLI](https://firebase.google.com/docs/cli).
- Un repositorio en GitHub con el código de la aplicación.

### 2. Comandos de Despliegue

#### Paso A: Subir a GitHub
```bash
git init
git add .
git commit -m "Ready for deployment"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

#### Paso B: Crear el Backend en Firebase
Ejecuta este comando y sigue los pasos en la terminal para vincular tu repo de GitHub con Firebase:
```bash
firebase login
firebase apphosting:backends:create --project TU_ID_DE_PROYECTO
```

### 3. Actualizaciones
A partir de la configuración inicial, cada vez que hagas un `push` a la rama `main`, Firebase reconstruirá y desplegará la aplicación automáticamente:
```bash
git add .
git commit -m "Descripción del cambio"
git push origin main
```

---

## 📱 Funcionalidades Principales
- **Perfiles Privados**: Sesiones separadas para Mary y Javi.
- **Importación con IA**: Carga de recetas mediante prompts inteligentes.
- **Gestión de Stock**: Inventario con alertas de stock bajo y sincronización diferencial.
- **Modo Cocina**: Instrucciones paso a paso con temporizadores integrados.
- **Optimización de Imágenes**: Compresión en cliente para cargas ultrarrápidas.

## Desarrollo Local
```bash
npm run dev          # Iniciar Next.js (Puerto 9002)
npm run genkit:dev   # Iniciar la UI de Genkit para pruebas de IA
```
