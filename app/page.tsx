import Link from 'next/link';
import { dateWindow, getMetrics, parseRange, RANGES, type SourceRow } from '@/lib/metrics';
import { SOURCE_LABEL, minutes, money, moneyRound, pct, rate } from '@/lib/format';

export const dynamic = 'force-dynamic'; // always fresh numbers

const REPLY_PROMISE_MIN = 5; // we promise a first reply within 5 minutes
const NO_SHOW_WARN_PCT = 30;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const days = parseRange(sp.range);
  const includeDemo = sp.demo !== '0';
  const { from, to } = dateWindow(days);

  let rows: SourceRow[] = [];
  let failed = false;
  try {
    rows = await getMetrics(from, to, includeDemo);
  } catch (err) {
    console.error('[dashboard] could not load metrics:', err instanceof Error ? err.message : err);
    failed = true;
  }

  // Cheapest booked call first; sources with no bookings go last
  const sorted = [...rows].sort((a, b) => (a.cost_per_booked ?? Infinity) - (b.cost_per_booked ?? Infinity));
  const priced = sorted.filter((r) => r.cost_per_booked !== null);
  const best = priced[0];
  const worst = priced.length > 1 ? priced[priced.length - 1] : undefined;
  const maxLeads = Math.max(1, ...rows.map((r) => r.leads));

  const link = (r: number, d: boolean) => `/?range=${r}${d ? '' : '&demo=0'}`;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">EM Growth · Lead sources</p>
          <h1>What does a booked call cost?</h1>
          <p className="sub">
            {fmtDate(from)} – {fmtDate(to)}
            {includeDemo ? ' · includes sample data' : ''}
          </p>
        </div>
        <nav className="controls" aria-label="Date range and data">
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r} href={link(r, includeDemo)} className={r === days ? 'on' : ''} aria-current={r === days ? 'true' : undefined}>
                Last {r} days
              </Link>
            ))}
          </div>
          <Link href={link(days, !includeDemo)} className="toggle" aria-pressed={includeDemo}>
            <span className={`dot ${includeDemo ? 'dot-on' : ''}`} aria-hidden /> Sample data {includeDemo ? 'on' : 'off'}
          </Link>
        </nav>
      </header>

      {failed ? (
        <section className="answer warn" role="alert">
          <p className="answer-text">Couldn’t load the numbers right now. Try again in a minute.</p>
        </section>
      ) : (
        <>
          {/* 1. The 10-second answer */}
          <section className="answer" aria-label="Answer">
            {best ? (
              <>
                <p className="answer-text">
                  Cheapest booked call: <strong className={`c-${best.source}`}>{SOURCE_LABEL[best.source]}</strong> at{' '}
                  <strong>{money(best.cost_per_booked)}</strong>.
                </p>
                {worst && worst.source !== best.source && best.cost_per_booked ? (
                  <p className="answer-sub">
                    {SOURCE_LABEL[worst.source]} costs{' '}
                    <strong>{(worst.cost_per_booked! / best.cost_per_booked).toFixed(1)}× more</strong> per booked call (
                    {money(worst.cost_per_booked)}).
                  </p>
                ) : null}
              </>
            ) : (
              <p className="answer-text">Not enough bookings in this period to compare sources yet.</p>
            )}
          </section>

          {/* 2. One card per source, never blended */}
          <section className="cards" aria-label="Cost by source">
            {sorted.map((r) => (
              <article key={r.source} className={`card b-${r.source}`}>
                <div className="card-head">
                  <h2 className={`c-${r.source}`}>{SOURCE_LABEL[r.source]}</h2>
                  {best && r.source === best.source ? <span className="badge">Cheapest</span> : null}
                </div>
                <p className="label">Cost per booked call</p>
                <p className="hero">{r.cost_per_booked === null ? <span className="na">No bookings yet</span> : money(r.cost_per_booked)}</p>
                <dl className="mini">
                  <div><dt>Per lead</dt><dd>{money(r.cost_per_lead)}</dd></div>
                  <div><dt>Per show</dt><dd>{money(r.cost_per_show)}</dd></div>
                  <div><dt>Spend</dt><dd>{moneyRound(r.spend)}</dd></div>
                </dl>
              </article>
            ))}
          </section>

          {/* 3. Funnel by source */}
          <section className="panel" aria-label="Funnel by source">
            <h2 className="panel-title">Leads → Qualified → Booked → Showed</h2>
            <div className="funnels">
              {sorted.map((r) => {
                const steps = [
                  { name: 'Leads', n: r.leads, conv: null as number | null },
                  { name: 'Qualified', n: r.qualified, conv: rate(r.qualified, r.leads) },
                  { name: 'Booked', n: r.booked, conv: rate(r.booked, r.qualified) },
                  { name: 'Showed', n: r.showed, conv: rate(r.showed, r.booked) },
                ];
                return (
                  <div key={r.source} className="funnel">
                    <h3 className={`c-${r.source}`}>{SOURCE_LABEL[r.source]}</h3>
                    {steps.map((s) => (
                      <div key={s.name} className="step">
                        <span className="step-name">{s.name}</span>
                        <span className="track" aria-hidden>
                          <span className={`bar bg-${r.source}`} style={{ width: `${Math.max(s.n > 0 ? 2 : 0, (s.n / maxLeads) * 100)}%` }} />
                        </span>
                        <span className="step-n">{s.n}</span>
                        <span className="step-conv">{s.conv === null ? '' : `${pct(s.conv)} of prev.`}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Speed + no-shows */}
          <section className="panel" aria-label="Speed and no-shows">
            <h2 className="panel-title">Speed to first reply and no-shows</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Median time to first reply</th>
                  <th scope="col">No-show rate</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const slow = r.median_minutes_to_reply !== null && r.median_minutes_to_reply > REPLY_PROMISE_MIN;
                  const highNs = r.no_show_rate_pct !== null && r.no_show_rate_pct > NO_SHOW_WARN_PCT;
                  return (
                    <tr key={r.source}>
                      <th scope="row" className={`c-${r.source}`}>{SOURCE_LABEL[r.source]}</th>
                      <td>
                        <span className={r.median_minutes_to_reply === null ? '' : slow ? 'pill bad' : 'pill good'}>
                          {minutes(r.median_minutes_to_reply)}
                        </span>
                        {r.median_minutes_to_reply !== null ? (
                          <span className="hint">{slow ? ' slower than the 5-min promise' : ' within the 5-min promise'}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={r.no_show_rate_pct === null ? '' : highNs ? 'pill warn' : 'pill good'}>{pct(r.no_show_rate_pct)}</span>
                        {r.showed + r.no_shows > 0 ? (
                          <span className="hint"> {r.no_shows} of {r.showed + r.no_shows} past calls</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <footer className="foot">
        <p>A lead counts in the period it signed up; its booking and show count with it.</p>
        <p>Spend comes from the ad spend sheet. Sample data is flagged and can be switched off above.</p>
        <p>Updated {new Date().toLocaleString('en-GB', { timeZone: 'Asia/Beirut', dateStyle: 'medium', timeStyle: 'short' })} (Beirut time)</p>
      </footer>
    </main>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
