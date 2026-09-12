/**
 * The reviewer's decision — Blueprint §11 and §16.5.
 *
 * Every control names exactly what it does and what it records. An outcome is
 * required before an alert can be closed, because the outcome is the only part
 * of a review that carries any signal: "resolved" says the queue moved,
 * "confirmed issue" or "false positive" says whether the flag was right.
 *
 * The copy is careful about what a dismissal means. It is a reviewer's
 * judgement recorded as a weak label, not proof the work was clean, and the
 * panel says so where the decision is made rather than in documentation
 * nobody reads at the moment of deciding.
 */

import { useState } from "react";

import { api, ApiError } from "../api/client";
import type { AlertStatus, ReviewEvent, ReviewOutcome } from "../api/types";

const OUTCOMES: { value: ReviewOutcome; label: string }[] = [
  { value: "confirmed_issue", label: "Confirmed issue" },
  { value: "false_positive", label: "False positive" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
  { value: "duplicate_alert", label: "Duplicate alert" },
  { value: "requires_field_inspection", label: "Needs field inspection" },
];

function when(iso: string): string {
  const stamp = new Date(iso);
  return Number.isNaN(stamp.valueOf()) ? iso : stamp.toLocaleString();
}

export default function ReviewActions({
  alertId,
  status,
  canReview,
  onChanged,
}: {
  alertId: number;
  status: AlertStatus;
  canReview: boolean;
  onChanged?: (status: AlertStatus) => void;
}) {
  const [current, setCurrent] = useState<AlertStatus>(status);
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<ReviewEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canReview) {
    return (
      <div className="panel panel--review">
        <h3 className="panel__head">Review</h3>
        <p className="muted">
          This view is read-only. Under the scheme a Member recommends works; the
          District Authority sanctions them and decides on flags.
        </p>
      </div>
    );
  }

  async function decide(next: AlertStatus) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.actionAlert(alertId, {
        status: next,
        outcome: outcome === "" ? null : outcome,
        note,
      });
      setCurrent(result.alert.status);
      setHistory(result.history);
      setNote("");
      onChanged?.(result.alert.status);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const closing = current === "resolved" || current === "dismissed";
  const needsOutcome = outcome === "";

  return (
    <div className="panel panel--review">
      <h3 className="panel__head">
        Review <span className={`pill pill--status pill--${current}`}>{current.replace("_", " ")}</span>
      </h3>

      <label className="field">
        <span className="field__label">Outcome</span>
        <select
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as ReviewOutcome | "")}
          disabled={busy}
        >
          <option value="">Select an outcome…</option>
          {OUTCOMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Note</span>
        <textarea
          value={note}
          rows={2}
          placeholder="What did you check, and what did you find?"
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="btn"
          disabled={busy || current === "under_review"}
          onClick={() => decide("under_review")}
        >
          Take for review
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || needsOutcome}
          onClick={() => decide("resolved")}
          title={needsOutcome ? "Record an outcome first" : undefined}
        >
          Resolve
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || needsOutcome}
          onClick={() => decide("dismissed")}
          title={needsOutcome ? "Record an outcome first" : undefined}
        >
          Dismiss
        </button>
      </div>

      {needsOutcome && !closing && (
        <p className="muted small">
          Closing an alert needs an outcome. The status says the queue moved; only the
          outcome says whether the flag was right.
        </p>
      )}

      {error && <div className="notice notice--soft">{error}</div>}

      {history.length > 0 && (
        <ol className="history">
          {history.map((event, index) => (
            <li key={`${event.reviewed_at}-${index}`}>
              <span className="history__when mono">{when(event.reviewed_at)}</span>
              <span>
                <strong>{event.reviewer}</strong> moved it {event.from_status.replace("_", " ")}{" "}
                → {event.to_status.replace("_", " ")}
                {event.outcome ? ` · ${event.outcome.replace(/_/g, " ")}` : ""}
              </span>
              {event.note && <span className="history__note">{event.note}</span>}
            </li>
          ))}
        </ol>
      )}

      <p className="muted small">
        A decision is recorded as a reviewer&rsquo;s judgement, not as proof. A dismissal
        may be correct or may be a missed case, so it is stored as a weak label and never
        promoted to ground truth.
      </p>
    </div>
  );
}
