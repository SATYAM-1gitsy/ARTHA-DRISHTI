# ADR 0012 — Calibrated fusion, and fire rate masquerading as strength

- **Status:** accepted
- **Date:** 2026-08-29

## Context

Three blocks produced the same finding by different routes: L1 helped only in a
narrow threshold band (Block 8), L4's marginal value was negative at every
weight (Block 10), and the single best layer beat the four-layer ensemble
(Block 11). The conclusion each time was that the weighted-sum combiner, not
the missing layers, had become the binding constraint. This block replaces it.

## What the measurement found

On 19,875 works with four layers running:

| layer | weight | fire% | mean\|fire | share of score mass | P@500 lift |
|---|---|---|---|---|---|
| rules | 0.30 | 51.60% | 0.460 | **89.1%** | 7.05 |
| unsupervised | 0.20 | 2.62% | 0.927 | 6.1% | 6.29 |
| duplicate | 0.10 | 3.04% | 0.692 | 2.6% | 1.05 |
| graph | 0.10 | 3.01% | 0.585 | 2.2% | **10.20** |

Two separate defects, and conflating them is why earlier weight sweeps went
nowhere.

**1. A weight was not an influence.** `rules` held 43% of the nominal weight
and **89% of the actual score mass**, because it fires on half the corpus while
the others fire on 3%. Its Spearman correlation with the fused score was
**0.944** — the "ensemble" was the rules layer wearing a hat. `graph`, the most
informative layer per work surfaced, carried 2.2%. Raw layer scores were never
on a common scale, so weighting them directly let **fire rate masquerade as
strength**.

**2. A mean cannot reward agreement**, and agreement was the strongest signal
present:

| layers firing | works | held-out rate |
|---|---|---|
| 0 | 8,940 | 1.09% |
| 1 | 9,973 | 2.18% |
| **2** | **887** | **10.94%** |
| 3 | 70 | 7.14% |
| 4 | 5 | 20.00% |

Two independent layers agreeing ran at five times the base rate. A weighted
mean cannot express that — two moderate signals average *below* one loud one —
so the arithmetic was actively discarding the best evidence in the system. The
layers are near-independent (max pairwise Spearman 0.102, rules/graph −0.001),
so this agreement is real corroboration rather than an echo.

## Decision — calibrate to rarity, then combine as independent evidence

    risk = 1 - prod_i q_i ** w_i        q_i = P(S_i >= s_i) over the population

`q_i` is the upper tail probability of the work's score on layer i, fitted
across the whole scored population in one pass, from **score distributions
only** — no labels, so nothing can leak into the ranking. The form is the
standard combination of independent tail probabilities, equivalently
`1 - exp(-sum_i w_i * surprisal_i)`; it is noisy-OR written in the coordinates
where the layers are comparable.

`contracts.risk` already models corroboration as `1 - 0.5^n` over independent
evidence families. This is the same algebra applied to the score instead of the
confidence, so the two quantities are coherent for the first time.

Two properties fall out rather than being special-cased: a silent layer has
`q = P(S >= 0) = 1` and contributes nothing to a product, and the weakest hit
on a 3%-fire-rate layer outranks the weakest hit on a 52% one — firing at all
on a rare layer *is* the evidence.

### Rejected: rank among the layer's own hits

The first implementation calibrated a score to its rank among that layer's
fired scores. It moved held-out PR-AUC by −0.003, i.e. nothing, and the reason
is worth recording: ranking within hits says a median `rules` hit is "halfway
up what rules flags", but rules flags half the corpus, so halfway up that is
unremarkable in the population. Measured against everything, the same hit sits
at q = 0.26 while a median `graph` hit sits at q = 0.015. **Rarity is the thing
layers can be compared on; their raw scores are not.**

### Rejected: re-tuning the weights

The weights are unchanged from Block 1. Tuning them against held-out PR-AUC
would fit the only honest metric the project has. The fix went into the
arithmetic, where it can be justified without reference to the answer.

## Result

Held-out, which is the quotable category:

| combiner | PR-AUC | P@500 | R@2000 | mean pattern lift |
|---|---|---|---|---|
| weighted_mean (Block 2) | 0.0929 | 16.8% | 28.3% | 12.0x |
| noisy_or (uncalibrated) | 0.0977 | 16.4% | 27.8% | 13.4x |
| **calibrated_noisy_or** | **0.1391** | 17.0% | **38.4%** | **19.7x** |

Per held-out pattern, recall @2000 — four of five up substantially:

| pattern | before | after |
|---|---|---|
| vendor_round_tripping | 28.9% | **52.6%** |
| photo_reuse | 25.5% | **38.8%** |
| geographic_displacement | 12.1% | **20.9%** |
| progress_reversal | 4.6% | **8.0%** |
| year_end_bunching | 80.0% | 77.9% |

At **matched review depth**, which is what an investigator actually experiences:

| queue | weighted_mean | calibrated | extra found |
|---|---|---|---|
| 100 | 32.0% (32) | **45.0% (45)** | +13 |
| 274 | 16.8% (46) | **23.4% (64)** | +18 |
| 500 | 16.8% (84) | 17.0% (85) | +1 |
| 2000 | 5.9% (118) | **8.0% (160)** | +42 |
| 3000 | 4.5% (135) | **6.2% (185)** | +50 |

Better at every depth, and most at the top where review capacity is scarcest.

The ensemble now equals its best single layer (graph alone, 0.140) while
retaining all four, where before it lost to it by a third.

## On the honesty of these numbers

The diagnostic above reads held-out labels — the co-firing table is built from
them. So the *design* was informed by the held-out set, and its held-out PR-AUC
is optimistically biased. Nothing is *fitted* to labels (calibration uses score
distributions; weights are unchanged), but "I chose this shape after looking"
is still a form of selection.

The column that survives the objection is **mean pattern lift**: each held-out
pattern scored on its own with the other four patterns' works removed, averaged
over patterns. A gain carried by one pattern leaves it flat. It went 12.0x →
19.7x, and **every one of the five patterns improved individually**. That is
the evidence the change is real rather than a fit.

`drishti eval` now ships this comparison on every run, so the claim is
reproducible rather than a one-off script.

## The ablation, re-run under the new combiner

Every layer's marginal contribution roughly tripled. The layers were not weak;
they were being made to fight each other.

| layer | marginal value before | after |
|---|---|---|
| rules | +0.020 | **+0.064** |
| graph | +0.007 | **+0.021** |
| unsupervised | +0.007 | **+0.017** |
| duplicate | −0.015 | −0.007 |

Single-layer figures are unchanged — rules only 0.107, graph only 0.140 — which
is the consistency check that matters: with one layer there is nothing to
combine, and the calibration is a monotone transform, so the ranking must be
identical. Only the *combinations* moved.

`without duplicate` (0.146) remains the strongest variant, so L4 still costs a
little on held-out. That is ADR-0010's finding unchanged and expected: no
held-out pattern is textual, and L4's justification lives in the
independent-corpus category rather than this one.

`without rules` is the informative outlier — worst PR-AUC of any four-layer
variant (0.075) but the **best R@2000 (42.7%)**, above the full stack's 38.4%.
Rules owns the head of the ranking and crowds the tail. That is the 51.6%
fire-rate problem seen from the other end, and it is the next block's work.

## Consequences

- **Calibration regressed.** Brier 0.0631 → 0.0836; mean predicted 0.114 vs
  observed 0.070, now flagged over-confident. `1 - prod q^w` produces larger
  values on average. This is a real cost, accepted because the score is
  presented as an ordering, never as a probability — the evidence card renders
  it as `0.62` under "how concerning this looks", not as a percentage. Making
  it probability-like would require fitting to labels, which is the thing this
  block refuses to do.
- **The bands widened.** critical 0.9% → 1.4%, high 0.5% → 4.5%, actionable
  1.4% → 5.8%. The cut-points (0.35 / 0.60 / 0.80) turn out to sit almost
  exactly at the 80th / 95th / 99th percentiles of the new distribution, which
  are defensible queue shares, so they were left alone. But a band cut-point is
  a *policy on a scale*, and this block moved the scale without anything in the
  system saying so. A new acceptance check now fails the build if a future
  combiner floods the queue.
- `assess()` takes an injected `combine` callable, defaulting to the Block 2
  weighted mean. `contracts` must not import `score`, so the combiner arrives
  as a parameter rather than an import, and the contract's own tests still
  exercise the original arithmetic.
- Fusion is now two-pass: calibration is fitted over the whole population
  before any work is assessed. Cost is 0.19s over 19,875 works.
- `FusionConfig.combiner` selects the arithmetic, and `weighted_mean` stays
  runnable so the harness compares against the real baseline rather than a
  reconstruction of it. Its name is **not** validated in `config`: `score`
  imports `config`, so reaching back would be a cycle. A test pins the
  configured default against the registry instead.
- **What this does not fix.** The top 500 is still 89% rules-driven, because
  rules produces 10,255 candidate works against graph's 598. The combiner can
  no longer let a common layer dominate *per work*, but it cannot manufacture
  candidates a rare layer never proposed. A rules layer firing on 51.6% of the
  corpus is a screening layer, not a detector, and that is the next constraint
  — not a fusion problem.
