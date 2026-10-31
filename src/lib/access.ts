/**
 * Control de acceso. Se activa con variables de entorno, así el código puede
 * publicarse antes de configurar Firebase:
 * - NEXT_PUBLIC_REQUIRE_LOGIN=1   → la app pide iniciar sesión con Google.
 * - NEXT_PUBLIC_ALLOWED_EMAILS / ALLOWED_EMAILS → correos de la familia, separados por coma.
 */
export const LOGIN_REQUIRED = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === '1';

/** Nombre de la cookie con el token de Firebase que leen las server actions */
export const TOKEN_COOKIE = 'cf_token';

export function parseEmails(list: string | undefined): string[] {
  return (list || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}
