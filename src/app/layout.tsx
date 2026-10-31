import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { THEME_BOOT_SCRIPT, THEME_COLORS } from '@/lib/theme';
import { APPLE_TOUCH_ICON_DATA_URI } from '@/lib/icon-data';

// Las acciones de IA (receta + foto con Gemini) pueden tardar más que el límite por defecto
export const maxDuration = 60;

// next/font: la fuente se sirve desde el propio dominio y no bloquea el render
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Cocina Familiar',
  description: 'Gestión de recetas familiares, stock, planificación y macros.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cocina Familiar',
  },
  // Una sola fuente de íconos, con las mismas direcciones en el HTML y en el manifest
  // (public/). iOS instala la app con el manifest; si sus íconos eran otros archivos
  // distintos del apple-touch-icon, la pantalla de inicio mostraba una "C" gris.
  icons: {
    icon: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    // Incrustado: la ventana "Agregar a Inicio" de iOS 26 puede fallar al descargarlo
    apple: [{ url: APPLE_TOUCH_ICON_DATA_URI, sizes: '180x180', type: 'image/png' }],
  },
  // Next 15 solo emite "mobile-web-app-capable"; iOS anteriores a 16.4 necesitan esta
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // La barra de estado se funde con el fondo ambiental
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Tema manual guardado: se aplica antes del primer pintado */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-body antialiased overflow-x-hidden min-h-[100dvh]">
        <AmbientBackground />
        <FirebaseClientProvider>
          <AuthGuard>
            <main className="min-h-[100dvh] flex flex-col max-w-lg mx-auto relative">
              <AppShell>
                {children}
              </AppShell>
            </main>
            <BottomNav />
          </AuthGuard>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
