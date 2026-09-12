/**
 * The Member's portfolio — Blueprint §11.
 *
 * "Framed as the health of your recommended works, constructive not
 * accusatory." That framing is not decoration here: under MPLADS the Member
 * *recommends* and the District Authority sanctions, pays and reports, so a
 * flag on a work describes execution rather than the recommendation. The note
 * saying so comes from the API payload rather than being written here, because
 * a second client must not be able to drop it.
 */

import type { MPAnalytics } from "../api/types";
import { GroupTable, KpiRow, money } from "./Overview";

function StatusBar({ counts }: { counts: Record<string, number> }) {
  const order = ["completed", "in_progress", "sanctioned", "abandoned"] as const;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;
  return (
    <div className="panel">
      <h3 className="panel__head">Where the works stand</h3>
      <div className="statusbar">
        {order.map((status) =>
          counts[status] ? (
            <span
              key={status}
              className={`statusbar__seg statusbar__seg--${status}`}
              style={{ width: `${(counts[status] / total) * 100}%` }}
              title={`${status.replace("_", " ")}: ${counts[status]}`}
            />
          ) : null,
        )}
      </div>
      <ul className="legend">
        {order.map((status) =>
          counts[status] ? (
            <li key={status}>
              <span className={`legend__dot legend__dot--${status}`} />
              <span>{status.replace("_", " ")}</span>
              <span className="mono num">{counts[status]}</span>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

export default function Portfolio({
  data,
  onSelectWork,
}: {
  data: MPAnalytics;
  onSelectWork: (workId: number) => void;
}) {
  return (
    <>
      <div className="notice notice--soft">{data.note}</div>

      <KpiRow kpis={data.kpis} />

      <div className="split split--wide">
        <StatusBar counts={data.by_status} />

        <div className="panel">
          <h3 className="panel__head">Earmarked areas</h3>
          <p className="muted">
            Share of this member&rsquo;s sanctioned cost in areas recorded as SC or ST.
          </p>
          <div className="quantities">
            <div className="quantity">
              <span className="quantity__value mono">{data.sc_share_pct}%</span>
              <span className="quantity__hint">
                Scheduled Caste areas · guideline floor 15%
              </span>
            </div>
            <div className="quantity">
              <span className="quantity__value mono">{data.st_share_pct}%</span>
              <span className="quantity__hint">
                Scheduled Tribe areas · guideline floor 7.5%
              </span>
            </div>
          </div>
          <p className="muted small">
            Share of sanctioned cost recorded here, not of the annual entitlement the
            Guidelines earmark. The two denominators are different.
          </p>
        </div>
      </div>

      <GroupTable rows={data.by_sector} caption="By sector" label="sector" limit={8} />

      <div className="panel">
        <h3 className="panel__head">
          Works flagged for review{" "}
          <span className="muted">
            {data.kpis.flagged} of {data.kpis.n_works}
          </span>
        </h3>
        {data.flagged_works.length === 0 ? (
          <p className="muted">No works in this portfolio are currently flagged.</p>
        ) : (
          <div className="tablewrap">
            <table className="queue__table">
              <thead>
                <tr>
                  <th>work</th>
                  <th>band</th>
                  <th className="num">risk</th>
                  <th className="num">sanctioned</th>
                  <th className="num">progress</th>
                </tr>
              </thead>
              <tbody>
                {data.flagged_works.map((work) => (
                  <tr
                    key={work.work_id}
                    className="row--clickable"
                    onClick={() => onSelectWork(work.work_id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onSelectWork(work.work_id);
                    }}
                  >
                    <td>
                      <span className="queue__desc">{work.description}</span>
                      <span className="queue__sub mono">
                        #{work.work_id} · {work.sector}
                      </span>
                    </td>
                    <td>
                      <span className={`pill pill--${work.band}`}>{work.band}</span>
                    </td>
                    <td className="num mono">{work.overall_risk.toFixed(2)}</td>
                    <td className="num mono">{money(work.sanctioned_cost)}</td>
                    <td className="num mono">{Math.round(work.progress_pct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
