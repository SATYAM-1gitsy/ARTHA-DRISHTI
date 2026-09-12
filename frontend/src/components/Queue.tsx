/**
 * The District alert queue — the workhorse screen.
 *
 * Its job is to answer "what do I act on today?", so it is sorted by risk and
 * every row shows *both* how concerning a work looks and how well evidenced
 * that is. A queue that showed only a score would rank a single unverified
 * rule hit alongside a four-way corroborated finding.
 */

import type { Band, WorkSummary } from "../api/types";
import { formatMoney, isActionable } from "../api/types";

const BAND_LABEL: Record<Band, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface Props {
  works: WorkSummary[];
  total: number;
  selected: number | null;
  onSelect: (workId: number) => void;
}

/** A 0–1 quantity as a small bar. Two of these side by side make the
 *  risk/confidence distinction visible without reading digits. Each is a
 *  bordered tint chip -- red-boxed for risk, green-boxed for confidence --
 *  rather than a solid block, so a queue row reads as a ranking and not as a
 *  set of verdicts. */
function Meter({ value, tone }: { value: number; tone: "risk" | "confidence" }) {
  return (
    <div className={`meter meter--${tone}`} title={value.toFixed(3)}>
      <div
        className={`meter__fill meter__fill--${tone}`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
      <span className="meter__value">{value.toFixed(2)}</span>
    </div>
  );
}

export default function Queue({ works, total, selected, onSelect }: Props) {
  if (works.length === 0) {
    return (
      <p className="muted">
        No works match this filter. Try clearing “needs action”.
      </p>
    );
  }

  return (
    <div className="queue">
      <div className="queue__meta muted">
        showing {works.length} of {total.toLocaleString()}
      </div>
      <div className="tablewrap">
        <table className="queue__table">
          <thead>
            <tr>
              <th scope="col">Work</th>
              <th scope="col">Band</th>
              <th scope="col">Risk</th>
              <th scope="col">Confidence</th>
              <th scope="col" className="num">
                Sanctioned
              </th>
              <th scope="col" className="num">
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {works.map((work) => (
              <tr
                key={work.work_id}
                onClick={() => onSelect(work.work_id)}
                className={work.work_id === selected ? "is-selected" : undefined}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(work.work_id);
                  }
                }}
              >
                <td>
                  <div className="queue__desc">{work.description}</div>
                  <div className="queue__sub mono">
                    #{work.work_id} · {work.state} · {work.work_type.replace(/_/g, " ")}
                  </div>
                </td>
                <td>
                  <span className={`pill pill--${work.band}`}>
                    {BAND_LABEL[work.band]}
                  </span>
                  {isActionable(work) && (
                    <span className="pill pill--action" title="band ≥ high and confidence ≥ 0.6">
                      needs action
                    </span>
                  )}
                </td>
                <td>
                  <Meter value={work.overall_risk} tone="risk" />
                </td>
                <td>
                  <Meter value={work.confidence} tone="confidence" />
                </td>
                <td className="num mono">{formatMoney(work.sanctioned_cost)}</td>
                <td className="num mono">{work.progress_pct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
