/**
 * The government footer.
 *
 * Three columns, in the order a reader needs them: what this content is, the
 * policy pages, and the standing disclaimers. The disclaimers are the reason
 * this component exists — they were scattered through the views, which is how
 * one quietly goes missing, and now they are on every screen regardless of
 * which section is open.
 *
 * What the first column deliberately does not say: "Government of India" as an
 * owner, or "Hosted by NIC". The guidelines are the content reference; the
 * build is a hackathon prototype, and the column says exactly that.
 */

import { BUILD, CONTENT_NOTE, PROTOTYPE_TAG, STANDING_DISCLAIMERS } from "./disclaimers";

/** Every policy page is a real stub on the About screen, not a dead link. */
const POLICIES: { id: string; label: string }[] = [
  { id: "terms", label: "Terms & Conditions" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "copyright", label: "Copyright Policy" },
  { id: "accessibility", label: "Accessibility Statement" },
  { id: "sitemap", label: "Sitemap" },
  { id: "help", label: "Help" },
];

export default function GovFooter({
  onPolicy,
  apiBaseUrl,
}: {
  onPolicy: (anchor: string) => void;
  apiBaseUrl: string;
}) {
  return (
    <footer className="gov-footer">
      <div className="gov-container">
        <div className="gov-footer__cols">
          <section>
            <h2>About this content</h2>
            <p>{CONTENT_NOTE}</p>
            <p>
              Independent student project. Not affiliated with, endorsed by, or
              hosted for any ministry or government body.
            </p>
          </section>

          <section>
            <h2>Policies &amp; help</h2>
            <ul>
              {POLICIES.map((policy) => (
                <li key={policy.id}>
                  <button
                    type="button"
                    className="gov-footer__link"
                    onClick={() => onPolicy(policy.id)}
                  >
                    {policy.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Standing disclaimers</h2>
            <ul className="gov-disclaimers">
              {STANDING_DISCLAIMERS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="gov-footer__bottom">
          <span>
            Last updated: {BUILD.updated} · Build v{BUILD.version} · {BUILD.wcag}
          </span>
          <span>
            {PROTOTYPE_TAG} · API <span className="mono">{apiBaseUrl}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
