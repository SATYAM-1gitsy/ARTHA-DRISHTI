# ADR 0004 — The synthetic generator, and what its numbers mean

- **Status:** accepted
- **Date:** 2026-08-29

## Context

There is no public, transaction-level, fraud-labelled MPLADS dataset. The one
real file the project has carries 543 allocation rows and no works at all
(ADR-0001), so every detector from L0 to L6 operates on data this generator
produces. That makes it the load-bearing dependency: its quality caps every
number measured downstream, and its weaknesses become the system's blind spots.

## Decision 1 — Anchor to the real spine, generate only beneath it

The generator does not invent geography. It loads the Silver tables from
Block 3 and takes from them:

- 36 real states with their true Lok Sabha seat counts
- 542 real constituencies with their reservation status
- each member's actual allocated limit, which drives how many works they fund
  (measured correlation between allocation and work count: > 0.5)
- real constituency names, which appear in generated work descriptions

Only the transactional layer below that — works, payments, progress updates,
assets, photo metadata — is synthesised.

**Districts are the exception, and are marked as such.** MPLADS funds flow
through a nodal district, which the source file does not carry. Districts are
therefore generated per state in proportion to seat count and carry
`is_synthetic = True`. Nothing downstream may present one as a real
administrative unit.

## Decision 2 — Generation and injection are separate modules

`generator.py` produces an anomaly-free population and injects nothing.
`inject.py` applies patterns on top. Two reasons, both practical:

- the normal population can be generated and inspected on its own, so
  "is this baseline realistic?" is answerable independently of "is this
  anomaly detectable?";
- no injection parameter can reach a data column by accident. Everything an
  injector knows goes to `fraud_label` and nowhere else.

The base population is also independent of the injection rate — they draw from
separate RNG streams — so changing difficulty does not perturb the normal data
and invalidate a comparison.

## Decision 3 — The baseline is deliberately not clean

Three properties make the benchmark harder on purpose:

- **Ordinary year-end seasonality.** Real government spending rises before a
  fiscal year closes, so the base population carries a mild March lift (~5%).
  The held-out `year_end_bunching` pattern must beat that, not a flat line.
- **Imperfect photo coverage.** ~31% of base works have no photograph, driven
  by `missing_rate`. A ghost-work detector cannot cheat by flagging every
  photo-less work; it needs the *conjunction* of paid, complete and no asset.
- **Genuine cost spread.** Costs are log-normal around the Schedule-of-Rates
  benchmark, so a legitimate minority of works really are expensive.

## Decision 4 — Rule-visible and held-out patterns (finding R-03)

Thirteen patterns, split by `PatternVisibility`:

| | patterns | what its recall means |
|---|---|---|
| rule-visible | 8 | a rule agreeing with its own injector — a **pipeline check** |
| held-out | 5 | no detector written against it — the **only quotable figure** |

Measured on a 20,000-work run at the default settings: 1,560 labels across
1,397 works, prevalence 7.05% against a configured 6%, held-out share 30%.
The overshoot comes from `pattern_overlap` and the two multi-work patterns,
and is bounded by a test.

## Decision 5 — Multi-work patterns get a budget, not a target list

`agency_concentration` is district-level: the anomaly exists only in the
aggregate, so every work in a captured district is genuinely affected and must
be labelled. Capturing one district per target work produced **2,063 labels
against a budget of ~90 — 61% of the entire ground-truth set**, which would
have let a model that learned nothing but agency share look excellent.

The injector now reads its target list as a *budget*: it captures districts
until roughly that many works are affected, then stops. A test asserts no
single pattern exceeds 35% of the label set.

`duplicate_work` labels both halves of each pair for the same reason — an
investigator shown one half of a duplicate cannot act on it.

## Acceptance, verified

**`seed=42` reproduces identical data.** All nine table hashes match across
runs; a different seed produces different data.

**No injection metadata in any data column.** `assert_no_label_leakage` runs
over every table before anything is persisted, so a leak fails the run rather
than producing a dataset that silently invalidates every metric.

**Every pattern leaves a real signal.** An injector that quietly no-ops still
writes labels, and recall against those labels would measure nothing. Measured
separation against the base population's own rate:

| pattern | injected | baseline |
|---|---|---|
| cost_inflation | 2.26× peer median | 1.00× |
| pre_sanction_payment | 95.7% | 0.3% |
| duplicate_work | 97.1% | 8.8% |
| advance_without_progress | 100% | 2.4% |
| agency_concentration | 76.0% district share | 25.9% |
| ineligible_work | 100% | 0.0% |
| split_payment | 99.1% | 0.0% |
| photo_reuse | 73.7% | 0.0% |
| year_end_bunching | 100% March | 5.1% |
| ghost_work | 100% no photo | 30.8% |

Rates below 100% are correct rather than defects: `pre_sanction_payment` can
only fire on works that have payments, and `photo_reuse` only on works that
have a photograph.

## Consequences

- Every performance figure this project produces is measured on data it
  generated. Held-out patterns make some of it meaningful; none of it is a
  claim about real-world MPLADS detection, and the evaluation harness must
  label the two differently.
- `drishti seed` writes nine tables plus a `generation_manifest.json`
  recording config, row counts, pattern counts and prevalence — so any result
  can be traced to the exact dataset that produced it.
- The difficulty knobs (`inject_rate`, `noise_level`, `pattern_overlap`,
  `missing_rate`, `held_out_share`) are the experiment surface for Block 15:
  a performance *curve* across difficulty is worth far more than one number
  at one setting.
