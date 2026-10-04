export type QRType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type DotStyle = 'square' | 'rounded' | 'circle' | 'diamond' | 'star' | 'connected';

export type FinderShape = 'square' | 'rounded' | 'circle';

export type GradientType = 'none' | 'linear' | 'radial';

export interface QRPayload {
  type: QRType;
  url?: string;
  text?: string;
  email?: { to: string; subject: string; body: string };
  phone?: string;
  sms?: { number: string; message: string };
  wifi?: { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
}

export interface QRStyle {
  /** Requested export size in px. The renderer snaps this to a whole-module grid. */
  size: number;
  fgColor: string;
  bgColor: string;
  /** Decorative shape applied to data modules only. Function patterns stay exact. */
  dotStyle: DotStyle;
  finderShape: FinderShape;
  errorCorrection: ErrorCorrectionLevel;
  margin: number;
  gradientType: GradientType;
  gradientColor1: string;
  gradientColor2: string;
  gradientAngle: number;
  logo: string | null;
  logoSize: number;
  logoPadding: number;
  logoBorderRadius: number;
}

export interface QRPreset {
  id: string;
  name: string;
  emoji: string;
  style: Partial<QRStyle>;
}

export interface RecentQR {
  id: string;
  payload: QRPayload;
  style: QRStyle;
  dataUrl: string;
  createdAt: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface RenderInfo {
  modules: boolean[][];
  moduleCount: number;
  version: number;
  /** Whole pixels per module. Never fractional — this is what keeps scanners happy. */
  cell: number;
  margin: number;
  totalModules: number;
  pixelSize: number;
}

export type VerifyStatus = 'idle' | 'pending' | 'pass' | 'fail';

export interface VerifyResult {
  status: VerifyStatus;
  /** True only when a real decoder read back the exact string we encoded. */
  ok: boolean;
  decoded: string | null;
  expected: string;
  decodeMs: number;
  version: number | null;
  contrastRatio: number;
  moduleCount: number;
  pixelSize: number;
  issues: string[];
}

export interface SheetConfig {
  count: number;
  start: number;
  /** Supports {{n}} for the number and {{label}} for the free-text label. */
  template: string;
  labelTemplate: string;
  codeSize: number;
  columns: number;
}

export interface SheetItem {
  index: number;
  label: string;
  value: string;
  dataUrl: string;
}

export type TapeTone = 'dim' | 'ok' | 'warn' | 'bad';

export interface TapeLine {
  id: number;
  at: string;
  text: string;
  tone: TapeTone;
}
