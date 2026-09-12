/**
 * The alert register.
 *
 * A queue answers "what do I act on today?"; a register answers "what is
 * outstanding, and where has it got to?" — which is the question a nodal
 * officer or an auditor asks, and the one the review workflow was already
 * recording answers to without anywhere to show them.
 *
 * It adds no request of its own. `/api/alerts` and `/api/alerts/stats` were
 * both already fetched on every role switch — the alerts only to learn each
 * work's current status — so this view renders data the app was throwing away.
 */

import { useState } from "react";

import type { Alert, AlertStats, AlertStatus } from "../api/types";

const STATUS_LABEL: Record<AlertStatus, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const FILTERS: { key: AlertStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "under_review", label: "Under review" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

function when(iso: string): string {
  const stamp = new Date(iso);
  return Number.isNaN(stamp.valueOf()) ? iso : stamp.toLocaleDateString();
}

/** A count breakdown, as a labelled list rather than a chart nobody can read. */
function Breakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="panel">
      <h3 className="panel__head">{title}</h3>
      <ul className="mix">
        {entries.map(([key, count]) => (
          <li key={key}>
            <span className="mix__label mono">{key.replace(/_/g, " ")}</span>
            <span className="mix__bar">
              <span
                className="mix__fill"
                style={{ width: `${(count / entries[0][1]) * 100}%` }}
              />
            </span>
            <span className="mix__count mono num">{count.toLocaleString("en-IN")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Alerts({
  alerts,
  stats,
  selected,
  onSelect,
}: {
  alerts: Alert[];
  stats: AlertStats | null;
  selected: number | null;
  onSelect: (workId: number) => void;
}) {
  const [filter, setFilter] = useState<AlertStatus | "all">("all");
  const rows = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);

  return (
    <>
      {stats && (
        <section className="stats">
          <div className="stat">
            <span className="stat__value mono">{stats.total.toLocaleString("en-IN")}</span>
            <span className="stat__label">alerts on record</span>
          </div>
          <div className="stat">
            <span className="stat__value mono">
              {(stats.by_status.open ?? 0).toLocaleString("en-IN")}
            </span>
            <span className="stat__label">open</span>
          </div>
          <div className="stat">
            <span className="stat__value mono">
              {(stats.by_status.under_review ?? 0).toLocaleString("en-IN")}
            </span>
            <span className="stat__label">under review</span>
          </div>
          <div className="stat">
            <span className="stat__value mono">{stats.median_confidence.toFixed(2)}</span>
            <span className="stat__label">median confidence</span>
          </div>
          <div className="stat stat--caution">
            <span className="stat__value mono">
              {(stats.low_confidence_share * 100).toFixed(0)}%
            </span>
            <span className="stat__label">thinly evidenced — leads, not cases</span>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__head">Alert register</h2>

        <div className="alerts__filters" role="group" aria-label="Filter by status">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="filter-chip"
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="muted">
            No alerts with this status in the current jurisdiction.
          </p>
        ) : (
          <>
            <div className="queue__meta muted">
              showing {rows.length.toLocaleString("en-IN")} of{" "}
              {alerts.length.toLocaleString("en-IN")} retrieved
            </div>
            <div className="tablewrap">
              <table className="queue__table">
                <thead>
                  <tr>
                    <th scope="col">Alert</th>
                    <th scope="col">Category</th>
                    <th scope="col">Band</th>
                    <th scope="col" className="num">
                      Risk
                    </th>
                    <th scope="col" className="num">
                      Confidence
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Raised
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 60).map((alert) => (
                    <tr
                      key={alert.alert_id}
                      className={alert.work_id === selected ? "is-selected" : undefined}
                      onClick={() => onSelect(alert.work_id)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(alert.work_id);
                        }
                      }}
                    >
                      <td>
                        <div className="queue__desc">{alert.summary}</div>
                        <div className="queue__sub mono">
                          #{alert.alert_id} · work {alert.work_id}
                        </div>
                      </td>
                      <td>{alert.category.replace(/_/g, " ")}</td>
                      <td>
                        <span className={`pill pill--${alert.band}`}>{alert.band}</span>
                      </td>
                      <td className="num mono">{alert.overall_risk.toFixed(2)}</td>
                      <td className="num mono">{alert.confidence.toFixed(2)}</td>
                      <td>
                        <span className={`pill pill--${alert.status}`}>
                          {STATUS_LABEL[alert.status]}
                        </span>
                      </td>
                      <td className="num mono">{when(alert.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {stats && (
        <div className="split split--wide">
          <Breakdown title="By evidence family" counts={stats.by_family} />
          <Breakdown title="By band" counts={stats.by_band} />
        </div>
      )}
    </>
  );
}
