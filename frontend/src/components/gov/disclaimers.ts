/**
 * The standing disclaimers, verbatim and in one place.
 *
 * Each of these sentences is load-bearing: it is the difference between a
 * decision-support tool and an accusation. They were scattered across the app
 * footer, the KPI hints and the API payloads, which is how a line quietly
 * disappears in a redesign — so the exact strings live here, are rendered by
 * the government footer on every screen, and are still rendered in place by
 * the views that own them. Nothing here paraphrases; edit with care.
 */

export const DISCLAIMERS = {
  /** Mirrors the sentence the API returns on every aggregate payload. */
  synthetic:
    "Risk bands prioritise review. They are not findings of wrongdoing, and every figure here is measured on synthetically generated data.",
  valueUnderReview: "value under review — not value established as misused",
  ordering: "Scores are a priority ordering, not a probability",
  roleSwitch:
    "Role switching stands in for a signed identity claim — not a security boundary",
  layers: "L0 rules · L1 peer-relative · L3 network · L4 duplicates — L2, L6 not built",
} as const;

/** Rendered as the footer's standing-disclaimer column, in this order. */
export const STANDING_DISCLAIMERS: readonly string[] = [
  DISCLAIMERS.synthetic,
  DISCLAIMERS.ordering,
  DISCLAIMERS.valueUnderReview,
  DISCLAIMERS.roleSwitch,
  DISCLAIMERS.layers,
];

/**
 * Build identity shown in the footer's bottom row.
 *
 * A prototype that reports a date it was not built on is the same kind of
 * small lie the rest of this interface is careful to avoid, so this is a named
 * constant rather than `new Date()` — it says when the build was cut, not when
 * the page happens to be open.
 */
export const BUILD = {
  version: "0.1.0",
  updated: "5 Sep 2026",
  /** A target, not a certification. The wording matters. */
  wcag: "Compliant with WCAG 2.1 AA (target)",
} as const;

/**
 * Content provenance. Deliberately not "owned by the Government of India" and
 * not "hosted by NIC" — the guidelines are the reference, not the publisher.
 */
export const CONTENT_NOTE =
  "Content reference: MPLADS Guidelines, MoSPI (June 2016). Prototype built for Smart India Hackathon 2026.";

export const PROTOTYPE_TAG = "Prototype · SIH 2026";

/**
 * Descriptive context for the utility strip. Names the scheme's ministry so an
 * officer knows which domain they are in; it is not an ownership claim, and
 * the prototype tag sits beside it on the same strip for exactly that reason.
 */
export const MINISTRY_CONTEXT =
  "Government of India · Ministry of Statistics & Programme Implementation";
