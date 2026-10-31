# Activar el inicio de sesión

El código ya está publicado, pero apagado. Hasta completar estos pasos la app funciona sin login.

## 1. Firebase: activar Google
Consola de Firebase → proyecto `studio-7038936088-ac3f2` → **Authentication** → **Sign-in method** → **Google** → Habilitar → elegir correo de asistencia → Guardar.

## 2. Firebase: dominio autorizado
Authentication → **Settings** → **Authorized domains** → Agregar `recetas-sable.vercel.app`.

## 3. Google Cloud: URI de redirección
Google Cloud Console → mismo proyecto → **APIs y servicios** → **Credenciales** → cliente OAuth "Web client (auto created by Google Service)" → **URI de redireccionamiento autorizados** → agregar:

```
https://recetas-sable.vercel.app/__/auth/handler
```

## 4. Vercel: variables de entorno (Production)
| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_REQUIRE_LOGIN` | `1` |
| `NEXT_PUBLIC_ALLOWED_EMAILS` | correos de la familia, separados por coma |
| `ALLOWED_EMAILS` | los mismos correos |

Después, redeploy de producción. Probar el login en el iPhone **antes** del paso 5.

## 5. Firestore: reglas
Firestore Database → **Reglas** → reemplazar por el contenido de `firestore.rules.login` (con los correos reales) → Publicar.

## Volver atrás
Quitar `NEXT_PUBLIC_REQUIRE_LOGIN` y `ALLOWED_EMAILS` en Vercel, redeploy, y volver a publicar las reglas de `firestore.rules`.
