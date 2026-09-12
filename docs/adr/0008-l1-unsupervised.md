# ADR 0008 — L1 peer-relative anomaly detection, and two models that did not earn their place

- **Status:** accepted
- **Date:** 2026-08-29

## Context

L1 is the layer that needs no labels. Its value depends almost entirely on one
modelling choice — scoring a work against its *peers* rather than the
population — and on resisting the temptation to add detectors that sound
impressive without measuring whether they help.

This block also produces the project's first figures that carry a detection
claim, because L1 targets no pattern and can therefore be measured on held-out
ones honestly.

## Decision 1 — Peer-relative, with a fallback chain that is disclosed

Each work is scored inside the narrowest peer group large enough to support an
empirical distribution: `sector × work_type × state` → `sector × work_type` →
`sector` → all works, with `MIN_GROUP_SIZE = 30`.

On the real data, 14,002 works (71%) score against the narrowest group and
5,815 fall back one level. The level is carried into the reason text, because
*"the 99th percentile of comparable works in this state"* and *"the 99th
percentile of all works"* are different claims and an investigator is entitled
to know which one they are being shown.

## Decision 2 — Features are curated, not swept in

Twenty columns, one per distinct aspect. Feeding all 43 numeric columns would
count `unit_cost`, `unit_cost_vs_sor` and `unit_cost_peer_percentile` as three
independent signals when they are one quantity viewed three ways — finding
R-01's double-counting problem, applied at the feature layer rather than the
fusion layer. Raw values are used rather than pre-computed percentiles, because
L1 does its own peer-relative work.

## Decision 3 — Isolation Forest is available and switched off

ADR-0002 set the rule: a model must beat a named baseline to stay. Isolation
Forest was measured against ECOD + robust MAD on 19,817 works:

| variant | seconds | L1 P@500 | L1 R@2k | **fused** P@500 | **fused** R@2k |
|---|---|---|---|---|---|
| ECOD + MAD | 2.9 | 10.2% | 18.8% | **15.0%** | **28.6%** |
| ECOD + MAD + IsolationForest | 17.1 | 13.0% | 21.4% | 15.0% | 27.9% |

It genuinely improves L1 *in isolation*, and contributes **nothing** once fused
with L0 — identical precision, slightly worse recall — at **5.9× the compute**.
The interactions it captures appear to be ones the rules already cover.

`USE_ISOLATION_FOREST = False`, with the table in the source next to the flag,
so turning it on is a decision made with numbers rather than because it sounds
better. A test asserts it stays off.

## Decision 4 — Rank gating, after an absolute threshold proved unsound

Findings are emitted when a work's ensemble score sits in the top 2% of *its
own peer group*.

The first version gated on an absolute tail probability, which looked correct
and passed every unit test. It is not: `ecdf_tail` floors at `1/group_size`, so
a 52-member group can never produce a tail below 0.019. Any threshold under
that **silently disabled L1 for every narrow peer group** while continuing to
work on wide ones. A sweep exposed it — at 0.01 the layer fired on 0.0% of
works, at 0.02 on 24%.

Rank gating makes the criterion mean the same thing in a group of 40 and a
group of 900. Per-feature tails still explain the score; they no longer gate
it. A parameterised test now checks the fire rate is stable across group sizes.

The threshold itself was chosen by measurement, not taste:

| quantile | L1 fires | L1 P@500 | fused P@500 |
|---|---|---|---|
| 0.10 | 10.7% | 11.6% | 13.2% |
| 0.05 | 5.6% | 11.8% | 11.8% |
| **0.02** | **2.6%** | 10.2% | **15.0%** |
| 0.01 | 1.8% | 9.6% | 15.0% |

Only at 2% does adding L1 *improve* on L0 alone (14.4%). Broader settings
dilute it — direct empirical evidence for finding R-01, and for why Block 13's
correlation-aware fusion is needed rather than optional.

## The winsorization bug

`_prepare` clipped every feature to its 1st and 99th percentiles. That is
standard practice and exactly wrong in an anomaly detector: **the extreme value
is the signal**, and clipping made the top 1% of every column indistinguishable
from one another. A planted 50× outlier stopped ranking first, which is how the
test caught it.

Nothing needed the clipping — ECOD is rank-based and MAD uses the median, so
both were already robust to scale. Removing it raised queue precision from
75.3% to **79.3%**.

## Does L1 earn its place?

Yes, modestly, and the numbers say so rather than the architecture diagram.
Recall in the top 2,000, per **held-out** pattern — the only figures in this
project that carry a detection claim:

| pattern | L0 | L1 | L0+L1 |
|---|---|---|---|
| photo_reuse | 18.9% | **25.3%** | 25.3% |
| geographic_displacement | 14.0% | 14.0% | **16.1%** |
| progress_reversal | 14.9% | 14.9% | 14.9% |
| vendor_round_tripping | 13.0% | 10.9% | 10.9% |
| year_end_bunching | **75.3%** | 32.0% | 74.2% |
| **all held-out** | 26.2% | 18.8% | **27.4%** |

L1 is the only layer that finds `photo_reuse` well — no rule targets photo
duplication. The combination beats either alone, by 1.2 points.

`year_end_bunching` is worth reading closely: L0 recovers 75% of it with **no
rule written for it**. Moving a sanction into March pushes many works past the
assumed 75-day recommendation window, so `sanction_window_exceeded` fires. That
is genuine generalisation — a rule catching a pattern it was not designed for —
and it is exactly what the held-out set exists to reveal.

## Consequences

Adding L1 changed the band distribution sharply — high fell from 3,988 to 58,
and the flagged queue from 4,669 to 377. That is a *calibration* effect, not a
modelling insight: fusion divides by the total weight of present layers, so a
silent L1 halves a rules-only score. Fixed band constants are calibrated to the
layer set, which is a known weakness Block 13's calibrated fusion replaces.

Operationally the smaller queue is better, and measurably so:

| queue | size | precision (any injected) | held-out recall |
|---|---|---|---|
| high + critical | 377 | **79.3%** | 17.1% |
| top 500 | 500 | 66.8% | 17.5% |
| top 1000 | 1,000 | 45.9% | 21.6% |
| random baseline | — | 7.0% | — |

79.3% precision at an 11× lift over random is a queue a District officer can
work daily. **The precision figure includes rule-visible patterns and is
therefore partly circular; the held-out recall is the honest number.**
