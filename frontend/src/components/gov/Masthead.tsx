/**
 * The masthead — institutional identity, and the "which desk am I at" chip.
 *
 * The role chip reads "Signed in as", which is the officer-facing phrasing,
 * and is immediately qualified: the role switcher is a development stand-in
 * for a signed identity claim. That qualification is in the footer verbatim
 * and repeated as the chip's own title, because this is the one control on
 * screen most likely to be mistaken for authentication.
 */

import { DISCLAIMERS } from "./disclaimers";
import Monogram from "./Monogram";

export default function Masthead({ roleLabel }: { roleLabel: string }) {
  return (
    <>
      <div className="gov-masthead">
        <div className="gov-container">
          <div className="gov-brand">
            <Monogram className="gov-monogram" />
            <div className="gov-brand__text">
              <p className="gov-wordmark">Artha Drishti</p>
              <p className="gov-wordmark__sub">
                MPLADS Risk Intelligence · Decision-support for review teams
              </p>
            </div>
          </div>

          <div className="gov-signedin">
            <span className="gov-signedin__label">Signed in as</span>
            <span className="gov-chip" title={DISCLAIMERS.roleSwitch}>
              <span className="gov-chip__dot" aria-hidden="true" />
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="gov-tricolour" aria-hidden="true" />
    </>
  );
}
