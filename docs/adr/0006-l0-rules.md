# ADR 0006 — L0 rules, and three the Blueprint asked for that we did not write

- **Status:** accepted
- **Date:** 2026-08-29

## Context

L0 is roughly 40% of the value of this system, needs no training data, and is
100% explainable. A rule hit is a fact about the records with a citation
attached — usable by an auditor in a way a model probability is not.

Ten rules ship, spanning five evidence families.

## Decision 1 — Three rules deliberately not implemented

The Blueprint's starter set (§18.2) lists `geo_outside_district`, a year-end
sanction rule, and a duplicate-photo rule. Each targets a **held-out** pattern:
`geographic_displacement`, `year_end_bunching`, `photo_reuse`.

Writing them would make recall on those patterns ≈1.0 by construction and
destroy the only figures in this project that carry a detection claim
(finding R-03). They are omitted on purpose.

`Rule.__post_init__` raises if `targets` names a held-out pattern, so this is
enforced rather than remembered. A test asserts the constructor rejects
`geo_outside_district` specifically.

## Decision 2 — Provenance is mandatory, and visible

Every rule declares where its threshold came from:

| provenance | rules |
|---|---|
| `cag_finding` | pre_sanction_payment, advance_without_progress, spend_ahead_of_progress, completed_without_asset_photo |
| `guideline_clause` | potentially_ineligible_description |
| `peer_derived` | unit_cost_above_peers, agency_concentration |
| `assumed` | ceiling_breach, split_payment_near_ceiling, sanction_window_exceeded |

Each hit carries a `provenance_note` into the evidence card, so an assumed
ceiling renders as *"project assumption — not verified against a published
source"* rather than borrowing the authority of a real clause. Four of ten
rules rest on assumptions today; that number should fall when
`data/guidelines.md` lands (B-03).

Cost evidence leads with `unit_cost_above_peers` (peer-derived, defensible)
rather than the SoR ratio, which rests on an invented benchmark (R-05).

## Decision 3 — Abstention, not a silent pass

A rule whose required columns are null does not fire **and** does not count as
evidence of compliance. "We cannot tell" is not "compliant".

Abstention lowers that work's `confidence` — which is precisely why Seam B
carries confidence separately from score (R-02). A work with complete data
scores confidence 1.0; one where two rules could not be evaluated scores 0.8.

## Decision 4 — Saturating severity, not a sum

`score = 1 − Π(1 − wₖ)` over the hits, with weights low 0.20 → critical 0.95.
Two medium findings outweigh one, no quantity of low-severity hits reaches a
single critical, and nothing exceeds 1.0.

## Three bugs this block surfaced

**The generator was producing 455-unit hospitals.** `ceiling_breach` fired on
**80% of the population**. The cause was not the rule: `_build_works` drew
`quantity = uniform(30, 900)` for every work type, whether that meant metres of
road or a count of buildings. Median work cost was ₹8.4 crore — larger than a
member's entire ₹5 crore annual entitlement.

Fixed by adding `QUANTITY_RANGE` and `WORK_UNIT` to the domain model: linear
works in metres (200–2500), area works in square metres, point works 1–3 units.
Median work cost is now ₹8.1 lakh and `ceiling_breach` fires on 12.5%.

A test now asserts no rule fires on more than half the population — a rule that
does is a threshold bug, not a finding.

**`config.critical_rules` escalated a rule that does not exist.** It listed
`ghost_no_asset`; no rule implements that code, so the escalation could never
fire. Dead config that looked like policy. A test now asserts every entry names
a real rule.

**Rule factors were not JSON serializable.** Values came straight out of pandas
as numpy scalars, and `json.dumps` refuses `np.int64` — so the API would have
raised on *any* work with a rule hit, which is every work an investigator would
ever open. `to_jsonable` was already in `util.py`; the engine now uses it.

## Decision 5 — The photo rule screens, it does not prove

`completed_without_asset_photo` recovers 97.3% of injected ghost works but at
**6.8% precision**, because roughly 31% of works legitimately have no
photograph on record. Shipped as HIGH rather than CRITICAL, deliberately absent
from `critical_rules`, and its reason text says so: *"A missing photograph may
be a reporting gap rather than a missing asset — field verification is
needed."*

This is the clearest case in the project for why multi-layer corroboration
exists. A single-signal ghost detector is a screen; only corroboration across
independent families makes it actionable.

## Measured against ground truth

| rule → pattern | recall | precision | fire rate |
|---|---|---|---|
| potentially_ineligible_description → ineligible_work | 100.0% | 100.0% | 0.54% |
| split_payment_near_ceiling → split_payment | 99.1% | 100.0% | 0.56% |
| pre_sanction_payment → pre_sanction_payment | 95.7% | 62.5% | 0.89% |
| advance_without_progress → advance_without_progress | 86.4% | 90.5% | 0.53% |
| unit_cost_above_peers → cost_inflation | 72.1% | 11.0% | 3.66% |
| agency_concentration → agency_concentration | 51.1% | 92.6% | 0.62% |
| completed_without_asset_photo → ghost_work | 97.3% | 6.8% | 7.93% |

**These are pipeline-check figures, not detection claims.** Every one of these
patterns is rule-visible, so recall measures a rule agreeing with its own
injector (R-03). They confirm the engine works; they say nothing about
real-world performance. The held-out figures in Block 15 are the only ones that
will.

Two are worth reading as design signals rather than scores.
`unit_cost_above_peers` at 11% precision is expected: the 98th percentile
contains genuinely expensive legitimate works, and that is the correct
behaviour for a screening threshold. `agency_concentration` at 51% recall
reflects the injector capturing 65–85% of a district while the rule fires at
≥60% share — the boundary cases fall below it.

## Consequences

- 51.6% of works carry at least one rule hit, mostly the low-severity
  `sanction_window_exceeded` (36%), which rests on an assumed 75-day window.
  That number should be revisited when the real Guidelines land.
- L0 evaluates 10 rules over 19,817 works in 0.16 s.
- Every rule has a unit test firing it on a crafted work — the Block 6
  acceptance criterion — and a test asserts no rule ships without one.
