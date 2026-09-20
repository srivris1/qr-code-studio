export type QRType = 'url' | 'text' | 'email' | 'phone' | 'wifi';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type DotStyle = 'square' | 'circle' | 'rounded' | 'diamond' | 'star';

export type GradientType = 'none' | 'linear' | 'radial';

export interface QRPayload {
  type: QRType;
  url?: string;
  text?: string;
  email?: { to: string; subject: string; body: string };
  phone?: string;
  wifi?: { ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
}

export interface QRStyle {
  size: number;
  fgColor: string;
  bgColor: string;
  dotStyle: DotStyle;
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

export interface ScanResult {
  success: boolean;
  decodedText: string | null;
  decodeTimeMs: number;
  contrastRatio: number;
  score: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
