'use client';

import React from 'react';

const gradientes: Record<string, { from: string; to: string; emoji: string }> = {
  Desayuno: { from: '#F59E0B', to: '#FBBF24', emoji: '🥞' },
  Almuerzo: { from: '#2D9A6B', to: '#34D399', emoji: '🍽️' },
  Cena: { from: '#1A2E24', to: '#374151', emoji: '🌙' },
  Merienda: { from: '#F472B6', to: '#FB7185', emoji: '☕' },
  Postre: { from: '#A78BFA', to: '#C4B5FD', emoji: '🍮' },
  Snack: { from: '#FB923C', to: '#FDBA74', emoji: '🥨' },
};

interface GradientPlaceholderProps {
  categoria: string;
  className?: string;
}

export function GradientPlaceholder({ categoria, className = "" }: GradientPlaceholderProps) {
  const config = gradientes[categoria] || gradientes['Almuerzo'];

  return (
    <div
      className={`w-full h-full flex items-center justify-center rounded-2xl transition-all duration-300 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${config.from}, ${config.to})`,
      }}
    >
      <span className="text-4xl filter drop-shadow-md" role="img" aria-label={categoria}>
        {config.emoji}
      </span>
    </div>
  );
}
