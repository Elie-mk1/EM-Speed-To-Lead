export const SOURCE_LABEL = { meta: 'Meta Ads', website: 'Website', referral: 'Referral' } as const;

export function money(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyRound(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// No decimals, unless under 10% (then one decimal)
export function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v < 10 && v > 0 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
}

export function rate(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function minutes(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  if (v < 1) return `${Math.round(v * 60)} sec`;
  if (v < 60) return `${v.toFixed(1)} min`;
  return `${(v / 60).toFixed(1)} hrs`;
}
