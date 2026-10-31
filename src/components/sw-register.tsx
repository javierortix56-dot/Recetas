'use client';

import * as React from 'react';

/** Registra el service worker que permite abrir la app sin conexión (solo en producción) */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('[SW] no se pudo registrar', e));
  }, []);
  return null;
}
