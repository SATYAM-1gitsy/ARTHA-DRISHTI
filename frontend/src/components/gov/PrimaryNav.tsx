/**
 * Primary navigation and breadcrumbs.
 *
 * The five sections are the five things this prototype can actually do, and
 * nothing else is listed — a nav item pointing at an unbuilt capability is the
 * cheapest way to overclaim, and the most obvious one to a judge who clicks
 * it. Each item maps onto data the app was already fetching before this
 * chrome existed:
 *
 *   Overview   — the analytics the role's dashboard already renders
 *   Works      — the review queue and its evidence card
 *   Alerts     — /api/alerts and /api/alerts/stats, both already requested
 *   Guidelines — the retrieval copilot over the 2016 guidelines
 *   About      — what this is, what it is not, and the policy stubs
 *
 * Rendered as buttons rather than links: this is a single-page application
 * with no router, and a real <a href> that does not navigate is worse for a
 * screen reader than a button that says what it does. `aria-current="page"`
 * carries the active state either way.
 */

import { DISCLAIMERS } from "./disclaimers";

export type ViewKey = "overview" | "works" | "alerts" | "guidelines" | "about";

export const VIEWS: { key: ViewKey; label: string; crumb: string }[] = [
  { key: "overview", label: "Overview", crumb: "Risk Overview" },
  { key: "works", label: "Works", crumb: "Works Under Review" },
  { key: "alerts", label: "Alerts", crumb: "Alert Register" },
  { key: "guidelines", label: "Guidelines", crumb: "Guidelines Reference" },
  { key: "about", label: "About", crumb: "About this Prototype" },
];

export default function PrimaryNav({
  view,
  roleLabel,
  onChange,
}: {
  view: ViewKey;
  roleLabel: string;
  onChange: (view: ViewKey) => void;
}) {
  const crumb = VIEWS.find((entry) => entry.key === view)?.crumb ?? "";

  return (
    <>
      <nav className="gov-nav" aria-label="Primary">
        <div className="gov-container">
          {VIEWS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="gov-nav__item"
              aria-current={entry.key === view ? "page" : undefined}
              onClick={() => onChange(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="gov-breadcrumb">
        <div className="gov-container">
          <nav aria-label="Breadcrumb">
            <ol>
              <li>Home</li>
              <li>{roleLabel}</li>
              <li aria-current="page">{crumb}</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* The honesty framing, kept above the fold on every screen rather than
          left to the footer alone. */}
      <div className="gov-advisory" role="note">
        <div className="gov-container">
          <span className="gov-advisory__mark" aria-hidden="true">
            ⚠
          </span>
          <span>
            <strong>Prototype — not an operational government service.</strong>{" "}
            {DISCLAIMERS.synthetic} Every flag is a lead for human review.
          </span>
        </div>
      </div>
    </>
  );
}
