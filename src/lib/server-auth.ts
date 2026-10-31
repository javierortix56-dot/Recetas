import { cookies } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { TOKEN_COOKIE, parseEmails } from '@/lib/access';

// Claves públicas con las que Google firma los tokens de Firebase Auth
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

/**
 * Corta la server action si quien llama no inició sesión con un correo de la familia.
 * Sin ALLOWED_EMAILS configurado no hace nada (el login todavía no está activo).
 */
export async function requireUser(): Promise<void> {
  const allowed = parseEmails(process.env.ALLOWED_EMAILS);
  if (allowed.length === 0) return;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) throw new Error('No autorizado: iniciá sesión');
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const email = String(payload.email || '').toLowerCase();
    if (payload.email_verified !== true || !allowed.includes(email)) throw new Error('correo no permitido');
  } catch (e) {
    throw new Error(`No autorizado: ${(e as Error).message}`);
  }
}
