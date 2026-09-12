# ADR 0013 — L0 selectivity, and a threshold that cut its own median

- **Status:** accepted
- **Date:** 2026-08-29

## Context

ADR-0012 ended by naming the next constraint: the top 500 was 89% rules-driven
because L0 proposed 10,255 candidate works against `graph`'s 598. Calibrated
fusion stopped a common layer dominating *per work*, but it cannot manufacture
candidates a rare layer never proposed.

The sharpest form of the evidence was in the layer ablation: `without rules`
had the **worst PR-AUC of any four-layer variant (0.075) and the best R@2000 of
any variant at all (42.7%)**, above the full stack's 38.4%. Rules owned the
head of the ranking and crowded the tail.

## What the measurement found

L0 fired on 51.6% of the corpus. Three rules were nearly all of it, and
**provenance predicted which**:

| rule | fire rate | severity | provenance |
|---|---|---|---|
| `sanction_window_exceeded` | **36.1%** | low | ASSUMED |
| `ceiling_breach` | 12.8% | high | ASSUMED |
| `completed_without_asset_photo` | 8.1% | high | CAG_FINDING |
| `unit_cost_above_peers` | 3.6% | high | PEER_DERIVED |
| `agency_concentration` | 0.9% | medium | PEER_DERIVED |
| the other five | ≤0.9% each | | |

The two `ASSUMED` thresholds fired on 36% and 13%; the two `PEER_DERIVED` ones
on 3.6% and 0.9%. Unverified constants were generating 9,725 of the 10,255
flagged works. Greedy coverage: `sanction_window_exceeded` alone accounted for
36.1 of the 51.6 points, and the seven precise rules together added 2.9.

The decisive fact needed no labels at all. `SANCTION_WINDOW_DAYS = 75` sits at
the **64th percentile of its own distribution** — median 62 days, p75 86, p90
101. **A rule cutting through the middle of its own data is measuring
"typical", not "exceptional".** ADR-0006 had already noted this rule at 36% and
left it; this block acts on it.

## Decision — make it peer-relative

`sanction_window_exceeded` becomes `sanction_delay_above_peers`: the
recommendation-to-sanction lag ranked within `(sector, work_type, state)`
peers, flagged at or above the 98th percentile.

The percentile is `PEER_COST_PERCENTILE`, reused rather than chosen.
Introducing a second tunable cut-point is exactly where fitting to the
evaluation set would begin, and the project already committed to 0.98 for
`unit_cost_above_peers`.

Provenance moves ASSUMED → PEER_DERIVED. The citation records what was replaced
and why, and states plainly that **if a real guideline window is ever sourced
(open question D-09) the absolute check belongs back beside this one as a
separate rule** — "breached the statutory window" and "slower than comparable
works" are different findings, and the second must not be allowed to
impersonate the first.

A three-part change landed together, as a Seam A change must:
`contracts/gold.py` (63 columns now), `features/build.py`, `detect/rules.py`,
plus the fixture builder and the reviewer guidance in `api/store.py`.

### Rejected: acting on the per-rule ablation

Leave-one-rule-out flagged six rules as "removing it improves held-out PR-AUC",
including `unit_cost_above_peers` at +0.0079 and `completed_without_asset_photo`
at +0.0072.

**Acting on that would have been a serious error.** Those rules target
*rule-visible* patterns and score 89–100% rule-visible precision. Judging them
on held-out generalisation is ADR-0010's metal-detector-finding-wood problem
exactly: a targeted detector trades against held-out generalisation by
construction. They earn their place in their own evidence category.

The per-rule table did establish one thing worth keeping: `pre_sanction_payment`
is load-bearing. Dropping it costs **−0.0924**, more than L0's entire marginal
value.

`ceiling_breach` also stays. Its ₹25 lakh threshold sits at the 87th percentile,
which is tail-shaped, and a ceiling is a hard limit rather than a statistical
outlier. But the value is still ASSUMED and unverifiable without D-09.

## Result

L0 fire rate **51.6% → 27.1%**; the rule itself **36.1% → 3.6%**.

| held-out | before | after |
|---|---|---|
| PR-AUC | 0.1391 | **0.1549** |
| R@2000 | 38.4% | **50.1%** |
| P@500 | 17.0% | 17.2% |
| mean pattern lift (LOPO) | 19.7x | **22.4x** |

Marginal value rose again for every layer that has one:

| layer | Block 12 | Block 13 | Block 14 |
|---|---|---|---|
| rules | +0.020 | +0.064 | **+0.080** |
| graph | +0.007 | +0.021 | **+0.028** |
| unsupervised | +0.007 | +0.017 | +0.007 |
| duplicate | −0.015 | −0.007 | −0.007 |

`rules only` improved from 0.107 to **0.124** — removing 7,177 near-base-rate
flags made the layer better on its own, not merely less obstructive.

**Calibration improved**, reversing Block 13's one regression: Brier 0.0836 →
**0.0728**, mean predicted 0.185 → **0.138** against an observed 0.070. Fewer
spurious flags means fewer works carrying unearned risk.

Held-out `progress_reversal` recall went 8.0% → 14.9%, the weakest pattern
nearly doubling.

## The acceptance gate caught a real thing, and the check was wrong

`risk and confidence are not the same number` failed at +0.979, against a 0.95
ceiling.

The cause was not a regression. Making L0 selective moved **67.8% of works to
zero reasons**, where risk and confidence are both exactly 0 — the correct
answer, and a point mass that dragged the whole-population Pearson correlation
up. Among works that actually carry evidence the correlation *improved*, +0.891
→ **+0.869**, and the distinction the contract exists for was intact: 138 leads
(risk > 0.5, confidence < 0.5) against 1,404 corroborated cases.

The check was measuring the wrong population, and worse, it had a **perverse
incentive: the noisier the system, the more spread at the bottom, the better it
scored.** It punished this block for making the detector quieter.

It now measures the correlation over works carrying evidence, *and*
additionally asserts that both leads and cases exist in non-zero numbers —
because a low correlation means nothing if the system never produces both
kinds. That is strictly stronger than what it replaced.

## Consequences

- Gold view is 63 columns. `sanction_delay_peer_percentile` is nullable at
  96.5% coverage: a peer group thinner than `MIN_PEER_GROUP` cannot rank
  anything, and the rule abstains rather than guessing.
- The rule renamed, so `data/api/*.json` and any saved evidence card carrying
  `sanction_window_exceeded` are stale. Regenerated by `drishti score`.
- **Two ASSUMED constants still drive rules**: `PER_WORK_CEILING` (12.8% fire)
  and `SPLIT_PAYMENT_CEILING_BAND`. Neither can be resolved without a
  guidelines document. D-09 is now the highest-value open question in the
  project, not a documentation chore.
- **What this does not fix.** `duplicate` is still net-negative on held-out
  (−0.007), unchanged and expected. And the top of the ranking barely moved
  (P@500 17.0% → 17.2%) — this block bought its gain in the *body* of the
  queue, where R@2000 rose 11.7 points. The head is still where the least
  progress has been made.
