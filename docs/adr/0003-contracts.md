# ADR 0003 — The five seams, and two changes to the manual's contract

- **Status:** accepted
- **Date:** 2026-08-29
- **Supersedes:** the Layer Output Contract as written in DRISHTI Build Manual §3.3

## Context

Block 2 freezes the interfaces so five of six seats can write real code
against a stable surface instead of waiting on the generator. Two of those
interfaces differ from the Build Manual, and both differences come directly
from Block 0 findings that get dramatically more expensive to fix later.

## The seams

| Seam | Contract | Module |
|---|---|---|
| A | Gold feature view — one row per `work_id`, 62 columns | `contracts/gold.py` |
| B | Layer output — identical across L0–L6 | `contracts/layer.py` |
| C | Risk assessment and evidence card | `contracts/risk.py` |
| D | REST response shapes | `api/models.py` |
| E | Ground truth, and where it may not flow | `contracts/labels.py` |

Canonical database schema: `db/ddl.sql`, verified against `postgis/postgis:16-3.4`.

## Decision 1 — Seam B gains `confidence` and `data_quality`

Manual §3.3 defines a layer's return as `[work_id, score, reasons, factors]`.
That is one quantity where the system needs four.

A rule that fired on complete records and an anomaly model that fired on a row
missing half its inputs cannot present identically. The Block 0 brief requires
`overall_risk`, `confidence`, `severity` and `data_quality` as distinct fields
(finding R-02), and retrofitting confidence into seven detectors after they
exist is a seven-file breaking change across two people. So it lands before
any detector is written.

Consequences, enforced by tests:

- `score`, `confidence` and `data_quality` are each validated to `[0, 1]` at
  construction. Normalisation happens inside the layer, never in fusion.
- A layer emitting `score > 0` with no reason is rejected. An unexplained
  score cannot be shown to an investigator.
- Layers emit a row for every work, including zeros. A missing row is
  indistinguishable from a missing layer once fusion joins.
- `data_quality` fuses as the **weakest link**, not an average: one layer
  scoring on complete data does not repair another that scored on gaps.

## Decision 2 — `reasons` carries an evidence family

Manual §3.3 has `reasons: list[str]`. It is now `tuple[Reason, ...]`, where a
`Reason` carries `code`, `text`, `family`, `severity`, `provenance` and
`factors`. `LayerOutput.reason_texts` still yields the manual's plain string
list, so nothing that consumed the old shape breaks.

The family is what makes finding R-01 fixable. Fusion must count corroboration
across *independent evidence families* — financial, temporal, network,
textual, asset, compliance — not across layers. L0's ceiling rule, L1's peer
cost outlier and L2's top SHAP feature are three views of one `unit_cost`
observation; a weighted sum that treats them as three confirmations inflates
the score.

Measured on the committed fixture: three layers fire on work 7, two
independent families result, and confidence lands at 0.71 rather than the
0.875 three layers would have bought.

`provenance` carries findings R-05 and R-06 through to the UI, so an assumed
Schedule-of-Rates benchmark can never render as a quoted guideline clause.

## Decision 3 — confidence has an explicit formula

```
confidence = (1 - 0.5^n_families) x (0.5 + 0.5 x data_quality)
```

Saturating rather than linear, because the second independent signal is worth
far more than the fifth, and capped at 0.95 — no amount of corroboration
reaches certainty. Deterministic evidence quoted from a real guideline clause
gets a floor of 0.80 x data_quality, since a hard compliance violation is not
a probabilistic guess.

One family gives 0.50, two 0.75, three 0.875, four 0.94.

`is_actionable` requires band ≥ high **and** confidence ≥ 0.6. A high band on
a single evidence family is a lead to verify, not a case to open.

## Decision 4 — the critical band is capped by data quality

A confirmed critical rule escalates the band regardless of model score: due
process does not wait for a model to feel confident. But that escalation is
withdrawn when `data_quality < 0.40`. A confident presentation built on
mostly-missing inputs is the most damaging output this system could produce.

## Decision 5 — the leakage guard exempts the join key

`assert_no_label_leakage()` rejects label columns and pattern names in a
feature frame. It initially rejected `work_id` too, which made it fire on
every valid frame. A guard that cries wolf gets disabled, so `work_id` — the
key both seams legitimately share — is exempt. Caught by its own test.

## Consequences

- Changing any seam is a three-part commit: the contract, the fixture, and
  every producer and consumer, landed together so `main` never goes red.
  `drishti fixtures` rebuilds the fixtures; `drishti contracts` prints them.
- The committed fixtures (`sample_gold.parquet`, `sample_labels.json`,
  `sample_api/*.json`) carry 11 planted anomalies — 8 rule-visible, 3 held out
  — plus four rows with genuine gaps, so `data_quality` is exercised rather
  than being a constant nobody notices is wrong.
- `actual_completion_date` is declared `POST_OUTCOME` and excluded from model
  inputs automatically. It stays available for evaluation joins.
