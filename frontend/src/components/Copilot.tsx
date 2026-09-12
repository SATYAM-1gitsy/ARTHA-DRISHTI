/**
 * The analyst copilot — Blueprint §6, §10 and differentiator §16.6.
 *
 * The backend has answered guidelines questions since Block 18 and nothing in
 * the product ever called it. This is that surface, and three things about it
 * are load-bearing rather than decorative:
 *
 * 1. **The clauses are shown, always.** Not behind a disclosure, not below the
 *    fold. Retrieval is the substance of this feature and the model is a
 *    phrasing layer over it, so the citations render whether or not a model
 *    was involved. An answer whose sources are one click away is an answer
 *    nobody checks.
 * 2. **How the answer was produced is on the answer.** A sentence phrased by
 *    Gemini and a clause handed over verbatim look identical once they are on
 *    screen, and they do not carry the same authority. `generated_by` is
 *    rendered as a badge, not logged as debug output.
 * 3. **A degraded copilot says what is wrong with it.** "Answered by
 *    retrieval" is the same sentence whether no key is configured, the key is
 *    blocked, or the free-tier quota is spent — three unrelated situations
 *    with three unrelated fixes. The warning carries the reason.
 *
 * It never asks whether a work is fraudulent, and the disclaimer that says so
 * is part of every response rather than a footer this component supplies.
 */

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../api/client";
import type { CopilotAnswer, CopilotStatus } from "../api/types";

/** Questions that exercise real clauses in the 2016 guidelines. */
const SUGGESTIONS = [
  "What share of works must be in Scheduled Caste areas?",
  "What is the ceiling on a single work?",
  "How long does a district have to sanction a recommended work?",
  "Which works are ineligible under the scheme?",
];

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : String(error);
}

/**
 * How the answer was produced. Rendered next to it, because "the guidelines
 * say" and "a model phrased what the guidelines say" are different claims.
 */
function ProvenanceBadge({ by }: { by: CopilotAnswer["generated_by"] }) {
  if (by === "gemini") {
    return (
      <span className="pill pill--medium" title="Phrased by Gemini from the clauses below">
        phrased by Gemini
      </span>
    );
  }
  if (by === "retrieval") {
    return (
      <span className="pill pill--low" title="The clauses themselves, unaltered">
        clauses, verbatim
      </span>
    );
  }
  return (
    <span className="pill pill--critical" title="No guidelines corpus is loaded">
      unavailable
    </span>
  );
}

/**
 * The two capabilities, separately. Collapsing them to one "healthy" light
 * would either call a fully usable copilot broken, or hide a dead key behind
 * an answer that still arrives.
 */
function StatusLine({ status }: { status: CopilotStatus }) {
  return (
    <p className="copilot__status muted small">
      {status.corpus_available ? (
        <>
          <span className="mono">{status.n_chunks.toLocaleString()}</span> citable clauses ·{" "}
          {status.corpus_source}
        </>
      ) : (
        <>No guidelines corpus loaded — {status.corpus_problem}</>
      )}
      {" · "}
      {status.key_configured ? (
        <>
          phrasing model <span className="mono">{status.model}</span>
        </>
      ) : (
        <>no model key — answers are the clauses themselves</>
      )}
    </p>
  );
}

export default function Copilot({ workId }: { workId?: number | null }) {
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .copilotStatus(controller.signal)
      .then(setStatus)
      .catch(() => {
        // A copilot that cannot report its own status can still answer.
        // Failing the panel here would hide a working feature.
      });
    return () => controller.abort();
  }, []);

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.copilotAsk(trimmed));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  const explain = useCallback(async () => {
    if (workId == null) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.copilotExplain(workId));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, [workId]);

  return (
    <section className="panel copilot">
      <div className="panel__head">
        <h2>Guidelines copilot</h2>
        {workId != null && (
          <button type="button" className="copilot__explain" onClick={explain} disabled={busy}>
            Brief me on work #{workId}
          </button>
        )}
      </div>

      {status && <StatusLine status={status} />}

      <form
        className="copilot__ask"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask what the MPLADS guidelines require…"
          aria-label="Ask the guidelines"
          maxLength={1000}
        />
        <button type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>

      {!answer && !busy && (
        <ul className="copilot__suggestions">
          {SUGGESTIONS.map((text) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => {
                  setQuestion(text);
                  void ask(text);
                }}
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="notice notice--soft">{error}</div>}

      {answer && (
        <div className="copilot__answer">
          <div className="copilot__answer-head">
            <ProvenanceBadge by={answer.generated_by} />
            {answer.corpus && <span className="muted small">{answer.corpus}</span>}
          </div>

          <p className="copilot__text">{answer.answer}</p>

          {answer.warning && (
            <div className="notice notice--soft copilot__warning">{answer.warning}</div>
          )}

          {answer.sources.length > 0 && (
            <>
              {/* Never collapsed. The citations are the part that can be
                  checked, and a feature whose evidence is one click away is a
                  feature whose evidence nobody reads. */}
              <h3 className="copilot__sources-head">
                What this rests on — {answer.sources.length} clause
                {answer.sources.length === 1 ? "" : "s"}
              </h3>
              <ol className="copilot__sources">
                {answer.sources.map((source) => (
                  <li key={source.citation}>
                    <span className="copilot__cite mono">{source.citation}</span>
                    <p>{source.text}</p>
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="muted small copilot__disclaimer">{answer.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
