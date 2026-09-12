# ADR 0014 — L5 temporal, a layer that did not earn its place

- **Status:** accepted
- **Date:** 2026-08-31

## Context

L5 was the next block in the original order. Two of the five held-out patterns
are temporal — `year_end_bunching` and `progress_reversal` — which made this
the layer most at risk of quietly becoming a targeted detector, and the one
whose result mattered most.

ADR-0002 rejected recurrent models here on the grounds that a work carries
6–12 events. Measured before writing anything: median **4** progress updates
and **3** payments per work. The rejection stands. Everything below is
classical.

## Decision 1 — General statistics, and the temptations declined

Five features, all standard time-series or point-process statistics:

| feature | what it measures |
|---|---|
| `progress_roughness` | mean absolute second difference of the progress series |
| `progress_increment_cv` | dispersion of increments, scaled by mean *absolute* increment |
| `payment_interval_cv` | coefficient of variation of inter-payment gaps |
| `sanction_local_density` | same-MP sanctions within ±30 days, over an even-spread expectation |
| `peer_survival_at_age` | Kaplan-Meier probability a comparable work is still running |

Two specific temptations were declined, and each has a test that would catch
its return:

* **Not** `n_negative_progress_increments`. That is `progress_reversal` with a
  different name. A test asserts a strictly increasing stop-start series scores
  comparably on `progress_roughness` to a reversing one.
* **Not** "sanctioned in March". `is_year_end_sanction` exists in the Gold view
  and is deliberately excluded from L5's feature block. A test asserts a July
  cluster scores *identically* to a March cluster of the same geometry —
  `sanction_local_density` has no calendar.

Kaplan-Meier is written out in numpy rather than taken from lifelines: the
detection core runs on numpy and pandas alone (ADR-0001). Censoring is the
point — an incomplete work tells us its duration *exceeds* its current age, and
dropping those biases every estimate toward whatever finishes fast.

`peer_survival_at_age` is null for completed works. Scoring a work against
evidence of how it turned out is the circularity `Leakage.POST_OUTCOME` exists
to prevent.

## The bug that mattered

The survival signal fired on **nothing**. It was gated at an absolute survival
probability of 0.02, and the Kaplan-Meier curve bottoms out at **0.199** on
this population — the threshold was unreachable.

This is the Block 8 finding repeating in a new place. The project's own notes
already say it: *an absolute tail threshold silently disables a layer when the
estimator cannot reach it; gate on rank.* L1 learned it from `ecdf_tail`
flooring at `1/group_size`; L5 learned it from a survival curve that never
descends. Rank-gated now, with a test named for the failure.

Nothing would have reported this. The layer ran, emitted valid output, and
produced a plausible fire rate from its other signal.

## Result — L5 does not earn its place

Measured inside a single ablation run, so the only thing varying is the layer
set:

| variant | held-out PR-AUC | P@500 | R@2000 |
|---|---|---|---|
| **without forecast** | **0.155** | 17.2% | **50.1%** |
| all layers | 0.149 | 16.6% | 45.8% |
| forecast only | 0.022 | 4.0% | 10.6% |

Marginal value **−0.0058**. `forecast only` (0.022) sits beside `duplicate
only` (0.021) at the bottom of the table.

ADR-0010's rule:

> A layer must either improve held-out generalisation, **or** carry
> independent-corpus evidence measured on data the generator never produced.
> A layer with neither has not earned its place.

L5 has neither. Its weight is **0.00**.

## The argument not made

L5 raised several per-pattern *instance* counts, and that could have been
reported as the headline. It should not be, for two reasons.

First, the arithmetic is easy to misread. Per-pattern recall counts **pattern
instances** — 468 of them — while `R@2000` counts **distinct works** — 417 —
because 51 works carry more than one held-out pattern. The two have different
denominators, never sum, and can move in opposite directions. Quoting the one
that moved favourably would be selection dressed as measurement.

Second and more importantly, the metric was committed to before the result was
seen. Switching metrics because the agreed one gave a disappointing answer is
the failure R-03 exists to prevent, and it costs more than a layer is worth.

Building an independent corpus *now*, specifically to rescue L5, would be the
same mistake in slower motion. It is recorded as what **would** justify turning
the layer on — survival estimates checked against hand-verified delays, the way
ADR-0010 justified L4 — not as work done to reach a conclusion already wanted.

## Decision 2 — Zero weight, but the layer still runs

At weight 0 the layer executes (0.4 s) and still emits reasons, which count
toward evidence families and confidence but not toward `overall_risk`.

That is deliberate. *"Still incomplete 1,200 days after sanction, where only 2%
of comparable works were still running"* is useful to an investigator looking
at a work some other layer surfaced, even though it does not improve the
ranking. **Evidence and ranking are different jobs**, and the four-quantity
contract is what makes it possible to say so.

## Consequences

- Gold is 68 columns; the five temporal ones landed as a three-part Seam A
  change with the fixture and builder.
- **Coverage improved regardless of the ranking verdict**: works with recorded
  data gaps fell from 17,027 to 13,877, because the temporal columns describe
  works that previously had nothing on that axis.
- Headline metrics are unchanged from Block 14, as they must be at weight 0:
  held-out PR-AUC **0.155**, R@2000 **50.1%**, Brier **0.0728**.
- **An unexplained timing outlier.** The `without unsupervised` ablation variant
  took **1,497 s** against 37 s for `all layers`, which is a superset of it. A
  40× gap cannot be caused by the layer set, so it is environmental — but it is
  recorded rather than ignored, and if it recurs it is worth chasing.
- A reporting error was found and corrected while writing this up: the
  per-pattern figures quoted after Block 14 were partly carried over from Block
  13 because the eval output was read truncated. The true Block 14 values were
  materially **better** — `vendor_round_tripping` 95.9% rather than 52.6%. The
  handoff now carries measured values and the denominator caveat.
