
import type {Metadata} from 'next';
import './globals.css';
import { BottomNav } from '@/components/bottom-nav';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Cocina Familiar',
  description: 'Gestión de recetas familiares, stock, planificación y macros.',
  manifest: '/manifest.json',
  themeColor: '#2D9A6B',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cocina Familiar',
  },
  icons: {
    apple: 'https://picsum.photos/seed/hamburger/180/180',
  },
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground overflow-x-hidden">
        <FirebaseClientProvider>
          <AuthGuard>
            <main className="min-h-screen flex flex-col max-w-lg mx-auto bg-background relative shadow-xl">
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
