/**
 * The evidence card — the component that has to earn an officer's trust.
 *
 * Three things it does deliberately:
 *
 * 1. Shows all four quantities separately. Risk and confidence sit next to
 *    each other because "0.99 risk, 0.50 confidence" is a lead to verify and
 *    "0.99 risk, 0.88 confidence, four families" is a case to open.
 * 2. Renders provenance beside every finding, so an assumed threshold can
 *    never borrow the authority of a published clause (audit finding R-05).
 * 3. Ends with what verification would actually involve. The product of this
 *    system is a checkable lead, not a number.
 *
 * Structured as a case file rather than a card: a work reference line at the
 * top, labelled sections in a fixed order, and a provenance footer naming the
 * signal layers the assessment rests on. An officer who has to defend a
 * decision needs a record, and a record has the same shape every time.
 */

import type { EvidenceCard, Reason, Severity } from "../api/types";
import { formatMoney } from "../api/types";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Assumed thresholds must look different from cited ones. */
function provenanceLabel(provenance: string): { text: string; weak: boolean } {
  switch (provenance) {
    case "guideline_clause":
      return { text: "MPLADS Guidelines", weak: false };
    case "cag_finding":
      return { text: "CAG audit finding", weak: false };
    case "peer_derived":
      return { text: "derived from comparable works", weak: false };
    default:
      return { text: "project assumption — unverified", weak: true };
  }
}

function Quantity({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "risk" | "confidence" | "neutral";
}) {
  return (
    <div className={`quantity quantity--${tone ?? "neutral"}`}>
      <dt>{label}</dt>
      <dd className="quantity__value mono">{value}</dd>
      <dd className="quantity__hint">{hint}</dd>
    </div>
  );
}

function Finding({ reason }: { reason: Reason }) {
  const provenance = provenanceLabel(reason.provenance);
  return (
    <li className="finding">
      <div className="finding__head">
        <span className={`pill pill--${reason.severity}`}>{reason.severity}</span>
        <span className="finding__family mono">{reason.family}</span>
      </div>
      <p className="finding__text">{reason.text}</p>
      <p className={`finding__prov mono${provenance.weak ? " is-weak" : ""}`}>
        {provenance.text}
      </p>
    </li>
  );
}

export default function Evidence({ card }: { card: EvidenceCard }) {
  const { work, risk, peer_comparison: peers, data_quality: quality } = card;
  const reasons = [...risk.reasons].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const families = risk.corroborating_families;

  return (
    <article className="evidence">
      <header className="evidence__head">
        <p className="casefile__ref">
          <span>
            <b>Work Ref:</b> <span className="mono">#{work.work_id}</span>
          </span>
          <span>· {work.state}</span>
          <span>· {work.work_type.replace(/_/g, " ")}</span>
        </p>
        <h2>{work.description}</h2>
        <p className="muted">
          {work.state} · {work.sector.replace(/_/g, " ")} ·{" "}
          {formatMoney(work.sanctioned_cost)} sanctioned · {work.progress_pct.toFixed(0)}%
          complete
        </p>
      </header>

      <dl className="quantities">
        <Quantity
          label="Risk"
          value={risk.overall_risk.toFixed(2)}
          hint="how concerning this looks"
          tone="risk"
        />
        <Quantity
          label="Confidence"
          value={risk.confidence.toFixed(2)}
          hint={`${families.length} independent evidence ${
            families.length === 1 ? "type" : "types"
          }`}
          tone="confidence"
        />
        <Quantity
          label="Severity"
          value={risk.severity}
          hint="consequence if confirmed"
        />
        <Quantity
          label="Data quality"
          value={quality.score.toFixed(2)}
          hint={
            quality.missing_fields.length
              ? `${quality.missing_fields.length} fields missing`
              : "inputs complete"
          }
        />
      </dl>

      {families.length <= 1 && (
        <p className="notice notice--soft">
          Based on a single type of evidence. Verify before drawing any
          conclusion — one signal is a lead, not a case.
        </p>
      )}

      {risk.escalated_by_rule && (
        <p className="notice notice--rule">
          Priority raised by the deterministic rule{" "}
          <code>{risk.escalated_by_rule}</code>, independently of the model score.
        </p>
      )}

      <section className="casefile__section">
        <h3>Why flagged</h3>
        <ul className="findings">
          {reasons.map((reason) => (
            <Finding key={reason.code} reason={reason} />
          ))}
        </ul>
      </section>

      <section className="casefile__section">
        <h3>Compared against</h3>
        {peers.sufficient_peers ? (
          <p>
            {peers.unit_cost !== null && (
              <>
                Unit cost {formatMoney(peers.unit_cost)}
                {peers.unit_cost_percentile !== null && (
                  <>
                    {" "}
                    sits at the{" "}
                    <strong>
                      {(peers.unit_cost_percentile * 100).toFixed(1)}th percentile
                    </strong>
                  </>
                )}{" "}
                of <strong>{peers.peer_group_size}</strong> comparable works
                {peers.median_peer_unit_cost !== null && (
                  <> (median {formatMoney(peers.median_peer_unit_cost)})</>
                )}
                .
              </>
            )}
          </p>
        ) : (
          <p className="muted">
            Only {peers.peer_group_size} comparable works exist, too few for a
            percentile to mean anything. No cost comparison is offered.
          </p>
        )}
        <p className="muted mono">peer group: {peers.peer_group}</p>
      </section>

      <section className="casefile__section">
        <h3>Timeline</h3>
        <ol className="timeline">
          {card.timeline.map((event, index) => (
            <li key={`${event.kind}-${index}`}>
              <span className="timeline__date mono">{event.at}</span>
              <span>{event.label}</span>
              {event.amount != null && (
                <span className="mono"> · {formatMoney(event.amount)}</span>
              )}
              {event.progress_pct != null && (
                <span className="mono"> · {event.progress_pct.toFixed(0)}%</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="casefile__section">
        <h3>Recommended checks</h3>
        <ul className="checks">
          {card.recommended_checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </section>

      {/* Provenance closes the record: which layers of the engine this
          assessment rests on, then the disclaimer the API itself attaches. The
          layer list names what was built, which is also what says L2 and L6
          were not. */}
      <footer className="evidence__foot casefile__provenance">
        <span className="casefile__signals mono">
          Signals: L0 · L1 · L3 · L4
        </span>
        {card.disclaimer}
      </footer>
    </article>
  );
}
