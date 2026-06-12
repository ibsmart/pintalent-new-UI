'use client';

import { useEffect, useState } from 'react';

export type Settings = Record<string, string>;

export function darken(hex: string, amount = 30): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - amount);
    const g = Math.max(0, ((n >> 8) & 0xff) - amount);
    const b = Math.max(0, (n & 0xff) - amount);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}

export function lighten(hex: string, opacity = 0.1): string {
  return hex + Math.round(opacity * 255).toString(16).padStart(2, '0');
}

export function useSettings(): { settings: Settings; loading: boolean } {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { setSettings(d); setLoading(false); });
  }, []);
  return { settings, loading };
}
