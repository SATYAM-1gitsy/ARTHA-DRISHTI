/**
 * The About screen, and the policy pages the footer links to.
 *
 * Two jobs. The first is to state, in one place a judge can read in thirty
 * seconds, what this system is and what it is not — including the signal
 * layers that were never built. Listing L2 and L6 as absent is more useful
 * than quietly omitting them, and it is the same claim the footer makes.
 *
 * The second is that every policy link in the footer lands somewhere real. A
 * stub that says "this is a prototype and collects nothing" is honest; a link
 * to a page that does not exist is the kind of detail that makes the rest of
 * an interface look decorative.
 */

import { useEffect } from "react";

import { BUILD, CONTENT_NOTE, DISCLAIMERS } from "./disclaimers";
import { VIEWS } from "./PrimaryNav";

/** Built and unbuilt, stated rather than implied by omission. */
const SIGNALS: { state: string; built: boolean; text: string }[] = [
  { state: "L0 · built", built: true, text: "Deterministic rules from published guideline clauses and CAG findings." },
  { state: "L1 · built", built: true, text: "Peer-relative comparison — unit cost against comparable works." },
  { state: "L3 · built", built: true, text: "Network signals over the agency graph." },
  { state: "L4 · built", built: true, text: "Duplicate and near-duplicate work detection." },
  { state: "L2 · not built", built: false, text: "Not implemented in this prototype." },
  { state: "L6 · not built", built: false, text: "Not implemented in this prototype." },
];

/**
 * `seq` makes the anchor a fresh object on every footer click, so asking for
 * the same policy twice still scrolls to it.
 */
export default function About({ anchor }: { anchor: { id: string; seq: number } | null }) {
  useEffect(() => {
    if (!anchor) return;
    document.getElementById(anchor.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [anchor]);

  return (
    <section className="panel doc">
      <h2 className="panel__head">About this prototype</h2>

      <p className="doc__lede">
        Artha Drishti ranks MPLADS works for human review. It orders a queue; it
        does not decide anything. Every screen in it is decision-support for a
        review team, and the system never issues a verdict.
      </p>

      <h3 id="what">What it does — and what it does not</h3>
      <ul>
        <li>
          It flags works for review and explains why, with the provenance of
          every threshold shown beside the finding.
        </li>
        <li>
          It compares a work against similar works and says when there are too
          few peers for a comparison to mean anything.
        </li>
        <li>
          It answers questions against the MPLADS Guidelines by retrieving the
          clauses themselves, with paragraph and page.
        </li>
        <li>
          It does <strong>not</strong> establish misuse, allocate blame, or
          produce a finding of wrongdoing. {DISCLAIMERS.ordering}.
        </li>
        <li>
          There is no satellite imagery, GIS feed, ledger, drone survey, escrow
          mechanism or live PFMS connection in this build. If it is not listed
          on this page, it does not exist here.
        </li>
      </ul>

      <h3 id="signals">Signal layers</h3>
      <ul className="capability">
        {SIGNALS.map((signal) => (
          <li key={signal.state}>
            <span className={`pill ${signal.built ? "pill--low" : "pill--medium"} capability__state`}>
              {signal.state}
            </span>
            <span>{signal.text}</span>
          </li>
        ))}
      </ul>

      <h3 id="data">Data</h3>
      <p>{DISCLAIMERS.synthetic}</p>
      <p>{CONTENT_NOTE}</p>

      <h3 id="terms">Terms &amp; Conditions</h3>
      <p>
        This is a hackathon prototype provided for demonstration and evaluation
        only, with no warranty and no service commitment. Nothing shown here is
        an official record, and no output may be relied on for any
        administrative, financial or legal decision.
      </p>

      <h3 id="privacy">Privacy Policy</h3>
      <p>
        The prototype operates on synthetically generated records and collects
        no personal information from visitors. No analytics, advertising or
        third-party trackers are loaded. The only data stored in your browser
        are your accessibility preferences — text size and high contrast — held
        locally and never transmitted.
      </p>

      <h3 id="copyright">Copyright Policy</h3>
      <p>
        Guideline text quoted by the copilot is reproduced from the MPLADS
        Guidelines published by the Ministry of Statistics and Programme
        Implementation and remains the property of its publisher; it is cited
        here with paragraph and page for verification. The application code and
        the monogram are original work by the project team. The State Emblem of
        India is not used anywhere in this interface.
      </p>

      <h3 id="accessibility">Accessibility Statement</h3>
      <p>
        This prototype targets WCAG 2.1 Level AA. It is a target rather than a
        certification: no formal audit has been carried out.
      </p>
      <ul>
        <li>A skip link is the first focusable element and moves focus to the main content.</li>
        <li>
          Text size can be set to three levels from the utility bar; the whole
          interface is sized in rem, so the setting scales it.
        </li>
        <li>A high-contrast mode is available from the same bar.</li>
        <li>
          Every interactive element — including table rows, which are
          keyboard-focusable — carries a visible focus ring.
        </li>
        <li>Data tables use header cells with a scope, and figures keep tabular alignment.</li>
        <li>Colour is never the only carrier of meaning: every band is also labelled in text.</li>
      </ul>
      <p>
        Found a barrier? Accessibility problems in this prototype are treated as
        defects — please raise them with the project team.
      </p>

      <h3 id="sitemap">Sitemap</h3>
      <ul>
        {VIEWS.map((entry) => (
          <li key={entry.key}>
            <strong>{entry.label}</strong> — {entry.crumb}
          </li>
        ))}
      </ul>

      <h3 id="help">Help</h3>
      <dl>
        <dt>Reading a row</dt>
        <dd>
          Risk says how concerning a work looks. Confidence says how well
          evidenced that is. A high risk with low confidence is a lead to
          verify, not a case to open.
        </dd>
        <dt>Roles</dt>
        <dd>
          The four roles ask four different questions of one engine. {DISCLAIMERS.roleSwitch}.
        </dd>
        <dt>Signals</dt>
        <dd>{DISCLAIMERS.layers}.</dd>
        <dt>Build</dt>
        <dd>
          Version {BUILD.version}, last updated {BUILD.updated}.
        </dd>
      </dl>
    </section>
  );
}
