# ADR 0007 — Thin fusion and the vertical slice

- **Status:** accepted
- **Date:** 2026-08-29

## Context

The point of a walking skeleton is that after it exists, every new layer is an
*addition to a working system* rather than a big-bang merge at the end. This
block opens that pipe: one work now travels the real allocation file →
generator → Gold view → L0 rules → fusion → API → a rendered evidence card, and
an acceptance gate keeps it open.

## Decision 1 — Fusion runs with whatever layers exist

`score/fusion.py` imports layer modules by name. A layer that is not yet
written is *absent*, not an error; a layer that raises is logged and skipped,
and the run continues. Adding L1 through L6 costs one line in
`config.fusion.weights` and one entry in `LAYER_MODULES`.

Two behaviours are asserted by tests because they are what make the slice
survive six more blocks: fusion emits **one row per work including the silent
ones** (a missing row is indistinguishable from a missing layer once joined),
and a failing layer does not lose the run.

Current state: 19,817 works scored in 5.9 s with `rules` alone.

## Decision 2 — One implementation behind both the fixtures and the routers

`api/store.py` builds every payload. The live routers call it, and
`api/publish.py` calls it to write `data/api/*.json` after each scoring run.

The fixture seam only works while the static JSON is *exactly* what the routers
return. Two implementations that agree today will not agree next week, so they
get one. A test asserts the live `/works/{id}/risk` response and the published
`work_risk.json` have identical keys.

## Decision 3 — The queue ranks by risk, then confidence

Confidence breaks ties so a thinly evidenced work never outranks a corroborated
one at the same score. The UI shows both as separate bars, because a queue
displaying one number would rank a single unverified rule hit alongside a
four-way corroborated finding and an officer would work them in that order.

The headline stat is deliberately uncomfortable: **70% of flagged works are
thinly evidenced — leads, not cases.** That is the honest state of a system
running one detection layer, and hiding it would be the beginning of
overclaiming.

## The design bug the gate caught

The acceptance check *"one evidence family is a lead, not a case"* failed with
**76 single-family works wrongly marked actionable**.

Cause: the deterministic confidence floor in `contracts/risk.py` keyed on
`provenance == "guideline_clause"`, lifting confidence to 0.80. But provenance
records where a *threshold* came from, not how certain a *finding* is. All 76
were lone `potentially_ineligible_description` hits — a keyword match, from a
rule whose own text says *"eligibility turns on the purpose and beneficiary,
which this check cannot establish — requires review."* The rule said "uncertain"
and the fusion said "0.80 confident".

Fixed by keying the floor on `config.critical_rules`, the curated set that is
both deterministic and precise. A payment predating its sanction is a
documentary fact and earns the floor; a keyword match does not.

The acceptance check was also wrong as written, and was corrected alongside:
single-family works are not actionable **unless** escalated by a deterministic
critical rule. A lone `pre_sanction_payment` on complete records genuinely is
actionable. The gate now reads: *18,540 single-family works; 155 actionable via
a deterministic critical rule, 0 wrongly actionable.*

## Decision 4 — One acceptance criterion implemented differently from the plan

The Block 0 plan specified *"a work with 3 missing fields gets data_quality
< 0.5"*. With 52 optional columns in the frozen Gold contract, three missing
fields gives 0.94. The constant predated the contract.

The **intent** is checked instead: data quality must fall as fields go missing,
and confidence must fall with it. Encoding the literal 0.5 would have meant
distorting the contract to satisfy a stale number, which is the wrong direction
of fit. This is recorded rather than quietly changed.

## The gate

`drishti e2e` runs ingest → seed → features → score, then asserts ten
properties. All currently pass:

| check | current |
|---|---|
| Gold view matches the Seam A contract | 19,817 × 62 |
| fixture is schema-identical to the real frame | yes |
| no ground-truth leakage into features | none |
| fusion emits four quantities in [0, 1] | yes |
| risk and confidence are not the same number | r = +0.81 |
| missing fields lower data quality | 1.000 vs 0.970 |
| one evidence family is a lead, not a case | 0 wrongly actionable |
| injected pre-sanction payments rank in top 10% | 95.7% |
| API payloads validate against Seam D | yes |
| every finding carries provenance | 769 findings, 0 unsourced |

A broken check reports as a failure rather than crashing the run, so a bug in
the gate never masks a bug in the pipeline.

The pre-sanction ranking figure is a **pipeline check, not a detection claim** —
that pattern is rule-visible, so recall on it measures a rule agreeing with its
own injector (R-03). The gate says so in its own output.

## Consequences

- The slice is green end to end. Blocks 8 onward add layers to a working
  system rather than assembling one.
- 4,669 works land in high or critical band with only L0 running, of which
  1,383 are actionable. That high-band share should fall as L1–L6 land and
  fusion stops being a single-layer passthrough.
- `data/api/*.json` is republished on every score, so the frontend can develop
  against real shapes with the API down.
- The evidence card renders provenance beside every finding, so "CAG audit
  finding" and "project assumption — unverified" are visually distinct at the
  point of use.
