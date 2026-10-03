import type { QRStyle, RenderInfo } from '../types';
import { computeLogoCoverage } from './qr-renderer';

export interface Diagnosis {
  level: 'pass' | 'warn' | 'fail';
  issues: string[];
}

const SPARSE_DOTS = new Set(['diamond', 'star']);

/**
 * Turns the verification result plus the style settings into a short, ranked
 * list of things that could make a scanner fail. The decode result is ground
 * truth — everything else is a hint about which setting caused it.
 */
export function diagnose(
  style: QRStyle,
  info: RenderInfo | null,
  contrastRatio: number,
  decode: { ok: boolean; decoded: string | null; expected: string } | null
): Diagnosis {
  const issues: string[] = [];
  let level: Diagnosis['level'] = decode && !decode.ok ? 'fail' : 'pass';

  if (decode && !decode.ok) {
    if (decode.decoded === null) {
      issues.push('A decoder read nothing at all from the rendered image — the code is not being located.');
    } else {
      issues.push('A decoder read a different string than the one encoded. The rendered picture does not match its data.');
    }
  }

  if (contrastRatio < 3) {
    issues.push(`Contrast is only ${contrastRatio.toFixed(1)}:1. Scanners need about 4:1 or better.`);
    level = level === 'fail' ? 'fail' : 'warn';
  } else if (contrastRatio < 4.5) {
    issues.push(`Contrast is ${contrastRatio.toFixed(1)}:1 — below the 4.5:1 that camera scanners reliably handle.`);
    if (level === 'pass') level = 'warn';
  }

  if (SPARSE_DOTS.has(style.dotStyle)) {
    issues.push(
      `The ${style.dotStyle} shape leaves gaps between modules, which thins the symbol. It only works at high error correction on a large print.`
    );
    if (level === 'pass') level = 'warn';
  }

  if (style.finderShape !== 'square' && decode && !decode.ok) {
    issues.push(`Decorative ${style.finderShape} finder patterns are the most common cause of "scans but won't open". Set finders to square.`);
  }

  if (style.margin < 4) {
    issues.push(`Quiet zone is ${style.margin} modules. The spec requires at least 4.`);
    if (level === 'pass') level = 'warn';
  }

  if (style.logo && info) {
    const coverage = computeLogoCoverage(info.moduleCount, style.logoSize, style.logoPadding, info.cell);
    if (coverage > 25) {
      issues.push(
        `The logo covers about ${coverage.toFixed(0)}% of the code. Level ${style.errorCorrection} can only recover ${style.errorCorrection === 'L' ? 7 : style.errorCorrection === 'M' ? 15 : style.errorCorrection === 'Q' ? 25 : 30}%.`
      );
      if (level === 'pass') level = 'warn';
    }
  }

  if (style.gradientType !== 'none') {
    issues.push('Gradients fade in one corner, which lowers contrast exactly where the finder patterns are.');
    if (level === 'pass') level = 'warn';
  }

  if (info && info.version >= 20) {
    issues.push(`Version ${info.version} is a very dense code (${info.moduleCount}×${info.moduleCount}). Keep it large to scan.`);
    if (level === 'pass') level = 'warn';
  }

  if (level === 'pass') issues.unshift('Decoded successfully from the rendered pixels, not from the source data.');

  return { level, issues };
}

/** A style that is boring on purpose — the fallback offered when decoding fails. */
export function safeStyle(style: QRStyle): QRStyle {
  return {
    ...style,
    dotStyle: 'square',
    finderShape: 'square',
    gradientType: 'none',
    margin: Math.max(4, style.margin),
    errorCorrection: 'H',
    logoSize: Math.min(style.logoSize, 16),
  };
}