# ADR 0009 — The evaluation harness, and the first numbers that mean anything

- **Status:** accepted
- **Date:** 2026-08-29

## Context

Every measurement in this project so far has been ad hoc — a script written to
answer one question and thrown away. That is fine for exploration and useless
for a claim. This block makes the measurement reproducible, and more
importantly makes it structurally difficult to produce a dishonest number.

## Decision 1 — Pooling is impossible, not merely discouraged

`EvaluationReport` has no combined metric field, and `pooled_metrics()` raises:

```
Rule-visible and held-out results must not be pooled (finding R-03).
A rule agreeing with its own injector is not detection.
Quote report.held_out; report.rule_visible is a pipeline check.
```

A convention everyone agrees with is a convention someone breaks at 2am before
a demo. A `NotImplementedError` is not. Tests assert both the raise and the
absence of any `combined` / `overall` / `pooled` field.

Serialised output carries `"quotable": true|false` on each section, and the
rendered report labels the rule-visible block **NOT a detection claim** in
capitals.

## Decision 2 — Metrics chosen for the actual job

At ~7% prevalence with a human at the other end, several popular metrics are
actively misleading:

- **Accuracy is not reported at all.** Predicting "clean" for everything scores
  93% here.
- **ROC-AUC is secondary.** At low prevalence it is dominated by the
  true-negative mass an investigator never sees, and stays flattering while the
  queue fills with false positives.
- **PR-AUC is the headline**, always reported against prevalence as a lift, so
  0.109 reads as "5.2× the base rate" rather than as a poor-looking number.
- **`false_positives_per_100_reviewed`** is included because it is what an
  officer experiences, and it makes a bad queue impossible to dress up.

Ties are scored worst-case in `average_precision`: a detector that assigns one
score to a thousand works cannot win on luck of ordering. A test pins that.

## Decision 3 — Ablation measures marginal value, not presence

Each layer alone, the full stack, and leave-one-out. The last is what answers
"does this layer earn its place?" — a layer whose removal changes nothing has
not, however sophisticated it is.

## The first quotable results

Held-out patterns, 19,817 works, layers `rules` + `unsupervised`:

| | held-out (quotable) | rule-visible (pipeline check) |
|---|---|---|
| positives | 416 (2.10%) | 983 (4.96%) |
| PR-AUC | **0.109** (5.2× prevalence) | 0.252 |
| P@500 | **14.8%** | 52.6% |
| R@500 | 17.8% | 26.8% |
| lift@500 | **7.1×** | 10.6× |
| false positives per 100 reviewed | **85** | 47 |

**85 false positives per 100 reviewed** is the honest state of this system on
patterns nobody wrote a detector for. It is a 7× lift over random, which is
real signal, and it is nowhere near good enough to present as a finished
detector. Both things are true and the report says both.

Per held-out pattern:

| pattern | recall @2000 |
|---|---|
| year_end_bunching | 74.2% |
| photo_reuse | 25.3% |
| geographic_displacement | 17.2% |
| progress_reversal | 16.1% |
| vendor_round_tripping | 10.9% |

`vendor_round_tripping` at 10.9% is close to chance, and correctly so: no layer
yet models payee relationships. That is L3's job, and this number is the
baseline it has to beat.

## Ablation

| variant | held-out PR-AUC | P@500 | R@2000 | secs |
|---|---|---|---|---|
| rules only | 0.096 | 14.0% | 26.2% | 5.9 |
| unsupervised only | 0.038 | 12.8% | 21.9% | 3.6 |
| **all layers** | **0.109** | **14.8%** | **28.1%** | 8.9 |
| without rules | 0.038 | 12.8% | 21.9% | 3.3 |
| without unsupervised | 0.096 | 14.0% | 26.2% | 5.5 |

Marginal value on held-out PR-AUC: **rules +0.0713**, **unsupervised +0.0129**.
Both earn their place; rules carry roughly five times the weight. The full
stack beats every single layer, which a test now asserts as an invariant.

## Calibration is measured, and labelled as not-yet-a-probability

Brier 0.0794; mean predicted **0.151** against mean observed **0.070** —
**over-confident by roughly 2×**.

That is expected and reported rather than hidden: the fused score is a
*priority ordering*, and nothing in the pipeline yet claims it is a
probability. These figures are the baseline Block 13's calibration has to
improve on. Until then a 0.8 must not be read as "80% likely to be a problem",
and the report says so in both the rendered output and the JSON.

Calibration is the one place where held-out and rule-visible data are combined,
and deliberately so: "does a 0.8 score mean 80%?" is a property of the score
itself, not a detection claim. That distinction is documented at the point it
is made.

## Consequences

- `drishti eval` writes `data/out/metrics.json` with every figure flagged
  quotable or not, so a later run can be diffed against this one.
- The ablation costs a full re-score per variant (~9 s each, five variants).
  `--no-ablation` skips it for a quick check.
- Numbers to beat, recorded here so later blocks have a baseline rather than a
  vibe: held-out PR-AUC **0.109**, P@500 **14.8%**, 85 false positives per 100
  reviewed, and `vendor_round_tripping` recall **10.9%**.
