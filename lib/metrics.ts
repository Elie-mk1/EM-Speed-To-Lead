import 'server-only';
import { supabaseServer } from './supabase-server';

export type SourceKey = 'meta' | 'website' | 'referral';

export type SourceRow = {
  source: SourceKey;
  leads: number;
  qualified: number;
  booked: number;
  showed: number;
  no_shows: number;
  median_minutes_to_reply: number | null;
  spend: number;
  cost_per_lead: number | null;
  cost_per_booked: number | null;
  cost_per_show: number | null;
  no_show_rate_pct: number | null;
};

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(v: string | string[] | undefined): RangeDays {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

// Inclusive date window ending today (UTC), e.g. 30 days = today and the 29 days before.
export function dateWindow(days: number, today = new Date()) {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getMetrics(from: string, to: string, includeDemo: boolean): Promise<SourceRow[]> {
  const { data, error } = await supabaseServer().rpc('em_dashboard', {
    p_from: from,
    p_to: to,
    p_include_demo: includeDemo,
  });
  if (error) throw new Error(`em_dashboard failed: ${error.message}`);

  return (data as Record<string, unknown>[]).map((r) => ({
    source: r.source as SourceKey,
    leads: Number(r.leads ?? 0),
    qualified: Number(r.qualified ?? 0),
    booked: Number(r.booked ?? 0),
    showed: Number(r.showed ?? 0),
    no_shows: Number(r.no_shows ?? 0),
    median_minutes_to_reply: num(r.median_minutes_to_reply),
    spend: Number(r.spend ?? 0),
    cost_per_lead: num(r.cost_per_lead),
    cost_per_booked: num(r.cost_per_booked),
    cost_per_show: num(r.cost_per_show),
    no_show_rate_pct: num(r.no_show_rate_pct),
  }));
}
