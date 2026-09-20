import type { RecentQR } from '../types';

const STORAGE_KEY = 'pro-qr-studio-recent';
const THEME_KEY = 'pro-qr-studio-theme';
const MAX_RECENT = 20;

export function loadRecent(): RecentQR[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentQR[];
  } catch {
    return [];
  }
}

export function saveRecent(item: RecentQR): void {
  const existing = loadRecent();
  const updated = [item, ...existing.filter(r => r.id !== item.id)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeRecent(id: string): void {
  const existing = loadRecent();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(r => r.id !== id)));
}

export function clearAllRecent(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
}
