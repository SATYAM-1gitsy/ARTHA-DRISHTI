/**
 * Four role views over one risk engine — Blueprint §3 and §11.
 *
 * The Blueprint describes four dashboards. They are not four products: the
 * Ministry groups the same engine by state, a State Nodal by district, a
 * District works the queue, and a Member sees their own portfolio. Switching
 * role changes the request headers, and the API narrows the data — so a
 * district officer opening the national view sees their district rather than a
 * refusal, and one set of components serves every role.
 *
 * The role switcher is a development stand-in for a signed identity claim, and
 * the footer says so. Anyone can set a header; nothing here is a security
 * boundary.
 *
 * Around all of that sits the government chrome — utility strip, masthead,
 * primary nav, breadcrumbs, standing advisory and policy footer. The chrome is
 * additive: it changes where the existing views are reached from, never what
 * they request or what they show. The five nav sections partition the same
 * page the app already rendered end to end, so nothing became unreachable and
 * no section promises a capability that was not built.
 */

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, setPrincipal } from "./api/client";
import type { Principal } from "./api/client";
import type {
  Alert,
  AlertStats,
  AlertStatus,
  EvidenceCard,
  MPAnalytics,
  NationalAnalytics,
  StateAnalytics,
  WorkSummary,
} from "./api/types";
import Alerts from "./components/Alerts";
import Copilot from "./components/Copilot";
import Evidence from "./components/Evidence";
import { GroupTable, KpiRow, PatternMix } from "./components/Overview";
import Portfolio from "./components/Portfolio";
import Queue from "./components/Queue";
import ReviewActions from "./components/ReviewActions";
import About from "./components/gov/About";
import AccessibilityBar from "./components/gov/AccessibilityBar";
import GovFooter from "./components/gov/GovFooter";
import Masthead from "./components/gov/Masthead";
import PrimaryNav from "./components/gov/PrimaryNav";
import type { ViewKey } from "./components/gov/PrimaryNav";

type Load<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; message: string };

type RoleKey = "ministry" | "state_nodal" | "district" | "mp";

interface RoleOption {
  key: RoleKey;
  label: string;
  question: string;
  principal: Principal;
}

/** The four stakeholders in Blueprint §3, each with the question they ask. */
const ROLES: RoleOption[] = [
  {
    key: "ministry",
    label: "Ministry",
    question: "Where are the systemic problems?",
    principal: { role: "ministry", subject: "mospi.analyst" },
  },
  {
    key: "state_nodal",
    label: "State Nodal",
    question: "Which of my districts are lagging or risky?",
    principal: { role: "state_nodal", state: "Maharashtra", subject: "nodal.mh" },
  },
  {
    key: "district",
    label: "District",
    question: "Which works do I act on today?",
    principal: { role: "district", district_id: 1, subject: "dc.office" },
  },
  {
    key: "mp",
    label: "Member",
    question: "What is the health of my recommended works?",
    principal: { role: "mp", mp_id: 1, subject: "mp.portfolio" },
  },
];

/** The heading each section carries above the role switcher. */
const VIEW_TITLE: Record<ViewKey, string> = {
  overview: "Risk overview",
  works: "Works under review",
  alerts: "Alert register",
  guidelines: "MPLADS Guidelines reference",
  about: "About this prototype",
};

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : String(error);
}

export default function App() {
  const [role, setRole] = useState<RoleOption>(ROLES[2]);
  const [view, setView] = useState<ViewKey>("overview");
  // Carries a sequence number so clicking the same footer policy link twice
  // still scrolls: the effect that consumes it depends on object identity.
  const [anchor, setAnchor] = useState<{ id: string; seq: number } | null>(null);
  const [stats, setStats] = useState<Load<AlertStats>>({ kind: "loading" });
  const [queue, setQueue] = useState<Load<{ items: WorkSummary[]; total: number }>>({
    kind: "loading",
  });
  const [overview, setOverview] = useState<Load<NationalAnalytics | StateAnalytics> | null>(
    null,
  );
  const [portfolio, setPortfolio] = useState<Load<MPAnalytics> | null>(null);
  const [card, setCard] = useState<Load<EvidenceCard> | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [actionableOnly, setActionableOnly] = useState(true);
  // Bumped when a reviewer records a decision. Without it the queue counters
  // kept saying "under review 0" while the panel beside them showed an alert
  // under review -- the same number, disagreeing with itself on one screen.
  const [reviewed, setReviewed] = useState(0);
  // alert_id -> current status, so the panel opens on the real state rather
  // than assuming "open". The id is the work id, which is what makes this a
  // lookup rather than a join.
  const [statuses, setStatuses] = useState<Map<number, AlertStatus>>(new Map());
  // The same response, kept rather than discarded: the register renders it.
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Switching role re-points every subsequent request. Clearing the selection
  // matters: a work visible to the Ministry may be outside the next role's
  // jurisdiction, and a stale evidence card would show data the new role is
  // not entitled to.
  useEffect(() => {
    setPrincipal(role.principal);
    setSelected(null);
    setCard(null);
    setOverview(null);
    setPortfolio(null);

    const controller = new AbortController();
    setStats({ kind: "loading" });
    api
      .alertStats(controller.signal)
      .then((data) => setStats({ kind: "ready", data }))
      .catch((error) => {
        if (!controller.signal.aborted) setStats({ kind: "error", message: message(error) });
      });

    api
      .alerts({ limit: 500 }, controller.signal)
      .then((page) => {
        setStatuses(new Map(page.items.map((alert) => [alert.alert_id, alert.status])));
        setAlerts(page.items);
      })
      .catch(() => {
        // A queue without statuses still works; every panel just opens on
        // "open", which is the default anyway.
      });

    setQueue({ kind: "loading" });
    api
      .listWorks({ actionable_only: actionableOnly, limit: 40 }, controller.signal)
      .then((page) => setQueue({ kind: "ready", data: { items: page.items, total: page.total } }))
      .catch((error) => {
        if (!controller.signal.aborted) setQueue({ kind: "error", message: message(error) });
      });

    if (role.key === "mp") {
      setPortfolio({ kind: "loading" });
      api
        .mp(role.principal.mp_id ?? 1, controller.signal)
        .then((data) => setPortfolio({ kind: "ready", data }))
        .catch((error) => {
          if (!controller.signal.aborted)
            setPortfolio({ kind: "error", message: message(error) });
        });
    } else if (role.key !== "district") {
      setOverview({ kind: "loading" });
      const request =
        role.key === "state_nodal" && role.principal.state
          ? api.state(role.principal.state, controller.signal)
          : api.national(controller.signal);
      request
        .then((data) => setOverview({ kind: "ready", data }))
        .catch((error) => {
          if (!controller.signal.aborted)
            setOverview({ kind: "error", message: message(error) });
        });
    }

    return () => controller.abort();
  }, [role, actionableOnly, reviewed]);

  // Opening a work opens the case file, wherever it was clicked from -- the
  // portfolio and the alert register both select works that are read in the
  // Works section.
  const select = useCallback((workId: number) => {
    setSelected(workId);
    setView("works");
    setCard({ kind: "loading" });
    api
      .evidence(workId)
      .then((data) => setCard({ kind: "ready", data }))
      .catch((error) => setCard({ kind: "error", message: message(error) }));
  }, []);

  const canReview = role.key !== "mp";

  const evidencePanel = (
    <aside className="panel panel--evidence">
      {card === null && (
        <p className="muted">
          Select a work to see why it was flagged, what it is being compared
          against, and what verifying it would involve.
        </p>
      )}
      {card?.kind === "loading" && <p className="muted">Loading evidence…</p>}
      {card?.kind === "error" && <p className="muted">{card.message}</p>}
      {card?.kind === "ready" && (
        <>
          <Evidence card={card.data} />
          <ReviewActions
            // Keyed on the work so selecting a different alert resets the
            // panel. Without it the internal status and history persist
            // and the next work opens showing the previous one's review.
            key={card.data.work.work_id}
            alertId={card.data.work.work_id}
            status={statuses.get(card.data.work.work_id) ?? "open"}
            canReview={canReview}
            onChanged={() => setReviewed((n) => n + 1)}
          />
        </>
      )}
    </aside>
  );

  return (
    <>
      <a className="gov-skip" href="#main">
        Skip to main content
      </a>

      <AccessibilityBar />
      <Masthead roleLabel={role.label} />
      <PrimaryNav
        view={view}
        roleLabel={role.label}
        onChange={(next) => {
          setView(next);
          setAnchor(null);
        }}
      />

      <main className="app" id="main" tabIndex={-1}>
        <header className="app__head">
          <h1 className="page-title">{VIEW_TITLE[view]}</h1>
          <p className="tagline">Flags works for human review. Never issues a verdict.</p>

          <p className="rolebar__label" id="role-label">
            Review role
          </p>
          <nav className="roles" aria-labelledby="role-label">
            {ROLES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.key === role.key ? "role role--active" : "role"}
                onClick={() => setRole(option)}
                aria-pressed={option.key === role.key}
              >
                <span className="role__label">{option.label}</span>
                <span className="role__q">{option.question}</span>
              </button>
            ))}
          </nav>
        </header>

        {stats.kind === "error" && (
          <div className="notice">
            <strong>Cannot reach the API.</strong> {stats.message}
            <pre>python -m drishti score</pre>
          </div>
        )}

        {/* --- Overview: the comparison views, the portfolio, or the district
            counters, depending on which question the role asks. --- */}
        {view === "overview" && (
          <>
            {overview?.kind === "loading" && <p className="muted">Loading…</p>}
            {overview?.kind === "error" && (
              <div className="notice notice--soft">{overview.message}</div>
            )}
            {overview?.kind === "ready" && (
              <>
                <KpiRow kpis={overview.data.kpis} />
                <div className="split split--wide">
                  {"by_state" in overview.data ? (
                    <GroupTable
                      rows={overview.data.by_state}
                      caption="By state"
                      label="state"
                      limit={12}
                    />
                  ) : (
                    <GroupTable
                      rows={overview.data.by_district}
                      caption="By district"
                      label="district"
                      limit={12}
                    />
                  )}
                  <PatternMix mix={overview.data.pattern_mix} />
                </div>
                <div className="split split--wide">
                  {"worst_districts" in overview.data && (
                    <GroupTable
                      rows={overview.data.worst_districts}
                      caption="Districts needing attention"
                      label="district"
                      limit={10}
                    />
                  )}
                  <GroupTable
                    rows={overview.data.worst_agencies}
                    caption="Agencies needing attention"
                    label="agency"
                    limit={10}
                  />
                </div>
                <p className="muted small">{overview.data.disclaimer}</p>
              </>
            )}

            {/* --- Member: the portfolio --- */}
            {portfolio?.kind === "loading" && <p className="muted">Loading…</p>}
            {portfolio?.kind === "error" && (
              <div className="notice notice--soft">{portfolio.message}</div>
            )}
            {portfolio?.kind === "ready" && (
              <Portfolio data={portfolio.data} onSelectWork={select} />
            )}

            {/* --- District: the counters over its own queue --- */}
            {role.key === "district" && stats.kind === "ready" && (
              <>
                <section className="stats">
                  <div className="stat">
                    <span className="stat__value mono">{stats.data.total.toLocaleString()}</span>
                    <span className="stat__label">flagged for review</span>
                  </div>
                  <div className="stat">
                    <span className="stat__value mono">
                      {(stats.data.by_band.critical ?? 0).toLocaleString()}
                    </span>
                    <span className="stat__label">critical band</span>
                  </div>
                  <div className="stat">
                    <span className="stat__value mono">
                      {(stats.data.by_status.under_review ?? 0).toLocaleString()}
                    </span>
                    <span className="stat__label">under review</span>
                  </div>
                  <div className="stat">
                    <span className="stat__value mono">
                      {stats.data.median_confidence.toFixed(2)}
                    </span>
                    <span className="stat__label">median confidence</span>
                  </div>
                  <div className="stat stat--caution">
                    <span className="stat__value mono">
                      {(stats.data.low_confidence_share * 100).toFixed(0)}%
                    </span>
                    <span className="stat__label">thinly evidenced — leads, not cases</span>
                  </div>
                </section>
                <p className="muted small">
                  This district works its queue directly — open{" "}
                  <strong>Works</strong> for the ranked list and the evidence
                  behind each flag.
                </p>
              </>
            )}
          </>
        )}

        {/* --- Works: the queue and the case file. Available under every role, --- */}
        {/* --- because every role can drill into the works it can see.       --- */}
        {view === "works" && role.key !== "mp" && (
          <div className="split">
            <section className="panel">
              <div className="panel__head">
                <h2>Review queue</h2>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={actionableOnly}
                    onChange={(event) => setActionableOnly(event.target.checked)}
                  />
                  needs action only
                </label>
              </div>

              {queue.kind === "loading" && <p className="muted">Loading…</p>}
              {queue.kind === "error" && <p className="muted">{queue.message}</p>}
              {queue.kind === "ready" && (
                <Queue
                  works={queue.data.items}
                  total={queue.data.total}
                  selected={selected}
                  onSelect={select}
                />
              )}
            </section>

            {evidencePanel}
          </div>
        )}

        {/* An MP drilling into one of their flagged works gets the evidence, read-only. */}
        {view === "works" && role.key === "mp" && (
          <>
            {card === null && (
              <p className="muted">
                Choose a flagged work from <strong>Overview</strong> to open its
                case file here.
              </p>
            )}
            {card?.kind === "ready" && (
              <aside className="panel panel--evidence">
                <Evidence card={card.data} />
                <ReviewActions
                  key={card.data.work.work_id}
                  alertId={card.data.work.work_id}
                  status={statuses.get(card.data.work.work_id) ?? "open"}
                  canReview={false}
                />
              </aside>
            )}
            {card?.kind === "loading" && <p className="muted">Loading evidence…</p>}
            {card?.kind === "error" && <p className="muted">{card.message}</p>}
          </>
        )}

        {view === "alerts" && (
          <Alerts
            alerts={alerts}
            stats={stats.kind === "ready" ? stats.data : null}
            selected={selected}
            onSelect={select}
          />
        )}

        {/* The copilot answers the same question for every role -- "what does
            the scheme actually require here" -- and only the work in front of
            the reader differs, which is what `workId` carries. */}
        {view === "guidelines" && <Copilot workId={selected} />}

        {view === "about" && <About anchor={anchor} />}
      </main>

      <GovFooter
        apiBaseUrl={api.baseUrl}
        onPolicy={(id) => {
          setView("about");
          setAnchor({ id, seq: Date.now() });
        }}
      />
    </>
  );
}
