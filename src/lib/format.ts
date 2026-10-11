/** Number formatting helpers shared by all calculators. */

export function toNum(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined || value === '') return fallback;
  const cleaned = String(value).replace(/[,\s_]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtInt(n: number): string {
  return nf0.format(Math.round(n));
}

export function fmtNum(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '-';
  if (decimals === 1) return nf1.format(n);
  if (decimals === 0) return nf0.format(n);
  return nf2.format(n);
}

/** Signed silver amount, e.g. "+12,480" in green / "-3,150" (class applied by caller). */
export function fmtSigned(n: number, decimals = 0): string {
  const s = decimals === 2 ? nf2.format(Math.abs(n)) : nf0.format(Math.abs(n));
  return `${n < 0 ? '−' : '+'}${s}`;
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return `${nf1.format(n)}%`;
}
