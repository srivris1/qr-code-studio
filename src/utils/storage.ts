import type { RecentQR, QRStyle } from '../types';

const STORAGE_KEY = 'pro-qr-studio-recent';
const THEME_KEY = 'pro-qr-studio-theme';
const MAX_RECENT = 24;
const MAX_DATA_URL_BYTES = 220_000;

const BASE_STYLE: QRStyle = {
  size: 512,
  fgColor: '#000000',
  bgColor: '#ffffff',
  dotStyle: 'square',
  finderShape: 'square',
  errorCorrection: 'M',
  margin: 4,
  gradientType: 'none',
  gradientColor1: '#0f766e',
  gradientColor2: '#134e4a',
  gradientAngle: 135,
  logo: null,
  logoSize: 18,
  logoPadding: 8,
  logoBorderRadius: 8,
};

export const DEFAULT_STYLE: QRStyle = { ...BASE_STYLE };

/**
 * Recent entries written by an older build are missing newer style keys.
 * Merging against the base style keeps `undefined` out of the renderer, which
 * is what previously made restored codes render differently from fresh ones.
 */
export function migrateStyle(input: Partial<QRStyle> | undefined): QRStyle {
  if (!input || typeof input !== 'object') return { ...BASE_STYLE };
  const merged = { ...BASE_STYLE, ...input } as QRStyle;
  if (merged.logoSize < 8) merged.logoSize = 8;
  if (merged.logoSize > 35) merged.logoSize = 35;
  merged.margin = Math.min(8, Math.max(0, Number(merged.margin) || 0));
  merged.size = Math.min(2048, Math.max(256, Number(merged.size) || 512));
  return merged;
}

export function loadRecent(): RecentQR[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentQR[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.payload && typeof item.dataUrl === 'string')
      .slice(0, MAX_RECENT)
      .map((item) => ({
        id: String(item.id),
        payload: { ...item.payload },
        style: migrateStyle(item.style),
        dataUrl: item.dataUrl,
        createdAt: Number(item.createdAt) || Date.now(),
      }));
  } catch {
    return [];
  }
}

function persist(items: RecentQR[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exhausted: drop the oldest half and keep going rather than throwing.
    const trimmed = items.slice(0, Math.floor(items.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently — history is a convenience, not a requirement */
    }
  }
}

export function saveRecent(item: RecentQR): void {
  if (item.dataUrl.length > MAX_DATA_URL_BYTES) return;
  const existing = loadRecent().filter((r) => r.id !== item.id);
  persist([item, ...existing].slice(0, MAX_RECENT));
}

export function removeRecent(id: string): void {
  persist(loadRecent().filter((r) => r.id !== id));
}

export function clearAllRecent(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadTheme(): 'dark' | 'paper' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'paper' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'paper' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: 'dark' | 'paper'): void {
  localStorage.setItem(THEME_KEY, theme);
}