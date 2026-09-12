/**
 * The Ministry, State Nodal and District views — Blueprint §11.
 *
 * One component for all three, because they are one engine grouped three ways:
 * the Ministry groups by state, a State Nodal by district, a District by
 * agency. Writing them separately is how "risky district" ends up meaning
 * three slightly different things on three screens, which is exactly what
 * stops a State and the Ministry discussing the same number.
 *
 * Ranked tables carry their denominator in the same row as their percentage.
 * "60% flagged" over five works and over five hundred are different claims,
 * and only one of them is worth an officer's morning.
 */

import type { GroupRow, Kpis } from "../api/types";

const RUPEE = "₹";

/** Indian-scale money. A crore column of raw rupees is unreadable. */
function money(value: number): string {
  if (value >= 1e7) return `${RUPEE}${(value / 1e7).toFixed(2)} cr`;
  if (value >= 1e5) return `${RUPEE}${(value / 1e5).toFixed(2)} lakh`;
  return `${RUPEE}${Math.round(value).toLocaleString("en-IN")}`;
}

function Kpi({
  value,
  label,
  hint,
  tone,
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: "caution";
}) {
  return (
    <div className={tone === "caution" ? "stat stat--caution" : "stat"}>
      <span className="stat__value mono">{value}</span>
      <span className="stat__label">
        {label}
        {hint ? <span className="muted"> — {hint}</span> : null}
      </span>
    </div>
  );
}

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <section className="stats">
      <Kpi value={kpis.n_works.toLocaleString("en-IN")} label="works covered" />
      <Kpi
        value={kpis.flagged.toLocaleString("en-IN")}
        label="flagged for review"
        hint={`${kpis.flagged_pct}%`}
        tone="caution"
      />
      <Kpi value={kpis.critical.toLocaleString("en-IN")} label="critical band" />
      <Kpi value={`${kpis.utilisation_pct}%`} label="funds utilised" />
      <Kpi
        value={money(kpis.value_flagged)}
        label="value under review"
        hint="not value established as misused"
      />
    </section>
  );
}

/** A bar that reads at a glance, so the eye can scan the column not the digits.
 *
 *  The fill sits inside a fixed-width track rather than filling the cell: with
 *  no track its width was a percentage of whatever the column happened to be,
 *  so the same share drew a different length in every table and ran under its
 *  own label. Same structure as the pattern-mix bars, for the same reason. */
function Share({ pct }: { pct: number }) {
  const width = Math.max(2, Math.min(100, pct));
  return (
    <div className="bar" title={`${pct}% flagged`}>
      <span className="bar__track">
        <span className="bar__fill" style={{ width: `${width}%` }} />
      </span>
      <span className="bar__value mono">{pct.toFixed(1)}%</span>
    </div>
  );
}

export function GroupTable({
  rows,
  caption,
  label,
  onSelect,
  limit = 12,
}: {
  rows: GroupRow[];
  caption: string;
  label: string;
  onSelect?: (key: string | number) => void;
  limit?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="panel">
        <h3 className="panel__head">{caption}</h3>
        <p className="muted">Nothing in scope.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3 className="panel__head">{caption}</h3>
      <div className="tablewrap">
        <table className="queue__table">
          <thead>
            <tr>
              <th>{label}</th>
              <th className="num">works</th>
              <th>flagged</th>
              <th className="num">critical</th>
              <th className="num">utilised</th>
              <th className="num">sanctioned</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr
                key={String(row.key)}
                className={onSelect ? "row--clickable" : undefined}
                onClick={onSelect ? () => onSelect(row.key) : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onKeyDown={
                  onSelect
                    ? (event) => {
                        if (event.key === "Enter") onSelect(row.key);
                      }
                    : undefined
                }
              >
                <td>{String(row.key)}</td>
                <td className="num mono">{row.n_works.toLocaleString("en-IN")}</td>
                <td>
                  <Share pct={row.flagged_pct} />
                </td>
                <td className="num mono">{row.critical}</td>
                <td className="num mono">{row.utilisation_pct}%</td>
                <td className="num mono">{money(row.sanctioned_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Which findings are driving the flags in this slice. */
export function PatternMix({ mix }: { mix: Record<string, number> }) {
  const entries = Object.entries(mix);
  if (entries.length === 0) return null;
  const top = entries[0][1];
  return (
    <div className="panel">
      <h3 className="panel__head">What is driving the flags</h3>
      <ul className="mix">
        {entries.map(([code, count]) => (
          <li key={code}>
            <span className="mix__label mono">{code}</span>
            <span className="mix__bar">
              <span className="mix__fill" style={{ width: `${(count / top) * 100}%` }} />
            </span>
            <span className="mix__count mono num">{count.toLocaleString("en-IN")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { money };
