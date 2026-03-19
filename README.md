
# Cocina Familiar 🍳

Aplicación para la gestión de recetas familiares, inventario y nutrición con **Next.js (App Router)**, **Genkit AI** y **Firebase**.

## 🚀 Guía de Despliegue (Firebase App Hosting)

Firebase App Hosting desplegará automáticamente tu aplicación cada vez que hagas un `push` a la rama `main` de tu repositorio de GitHub.

### 1. Comandos para Desplegar Cambios
Si ya tenés el repositorio vinculado, ejecutá estos tres comandos para subir tus mejoras:

```bash
git add .
git commit -m "Descripción de tus cambios"
git push origin main
```

### 2. Configuración Inicial (Solo la primera vez)
Si aún no has vinculado tu cuenta:
1.  **Subir a GitHub**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
    git push -u origin main
    ```
2.  **Crear el Backend**:
    ```bash
    firebase login
    firebase apphosting:backends:create --project studio-7038936088-ac3f2
    ```

---

## 📱 Funcionalidades Principales
- **Perfiles Privados**: Sesiones separadas para Mary y Javi con objetivos nutricionales independientes.
- **Importación con IA**: Carga de recetas mediante prompts inteligentes y procesamiento JSON estricto.
- **Gestión de Stock**: Inventario con alertas de stock bajo y sincronización diferencial automática.
- **Modo Cocina**: Instrucciones paso a paso con temporizadores integrados.
- **Icono PWA**: Icono de hamburguesa optimizado para "Añadir a pantalla de inicio" en iPhone/iOS.

## Desarrollo Local
```bash
npm run dev          # Iniciar Next.js (Puerto 9002)
npm run genkit:dev   # Iniciar la UI de Genkit para pruebas de IA
```
