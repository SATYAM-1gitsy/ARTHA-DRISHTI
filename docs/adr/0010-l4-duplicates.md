# ADR 0010 — L4 duplicate detection, and a third category of evidence

- **Status:** accepted
- **Date:** 2026-08-29

## Context

ADR-0002 named L4 the strongest deep-learning case in the project: the same
physical work is routinely recorded twice in different languages, and lexical
matching scores those pairs at roughly 0.04. Block 1c measured the encoder on a
hand-written corpus at ROC-AUC 0.939 against a lexical baseline of 0.486 —
worse than chance.

This block turns that capability into a detector, and in doing so forced a
change to how the project reports evidence at all.

## Decision 1 — Five signals, blocked by district

A pair is scored on semantic similarity (0.40), geographic proximity (0.20),
lexical overlap (0.15), cost similarity (0.15) and timing (0.10). Semantic is
deliberately under half: a pair agreeing on text and nothing else must not
clear the threshold on its own, because *"boundary wall for the primary
school"* and *"boundary wall for the crematorium"* share almost every word.

Blocking by district reduces 196,346,836 naive comparisons to **259,230**
(0.13%). The cost is stated rather than hidden: **a duplicate split across two
districts is missed.** Widening the block is a later trade against runtime.

Every finding cites the twin work id, because an investigator cannot act on
"this is a duplicate" without being told a duplicate of *what*.

## Decision 2 — The generator was making this too easy

The duplicate injector cloned descriptions **verbatim**. TF-IDF matched every
pair at similarity 1.00 and recall was 95.7% — a duplicate findable by string
equality, which tests nothing a transformer is for.

The injector now produces three flavours in roughly equal measure: verbatim
re-entry, paraphrase in the same language, and the same work recorded in the
other language. TF-IDF recall immediately fell from **95.7% to 69.0%**, which
is the benchmark becoming honest rather than the detector getting worse.

## Decision 3 — Thresholds are backend-specific, because they must be

Running the bi-encoder at the TF-IDF threshold flagged 2,086 works at **8.7%
precision**. The cause: sparse TF-IDF puts unrelated descriptions near 0, while
dense embeddings put them at a measured median of **0.453**. A threshold of
0.62 sits below the dense median and gates nothing.

| backend | threshold | recall | precision | F1 |
|---|---|---|---|---|
| TF-IDF | 0.62 | 69.0% | 25.3% | 0.370 |
| bi-encoder | 0.70 | 67.6% | 30.0% | 0.415 |
| **bi-encoder** | **0.75** | 51.4% | 53.7% | **0.526** |
| bi-encoder | 0.80 | 37.1% | 79.6% | 0.506 |

At matched recall the bi-encoder is the better instrument (30.0% vs 25.3%), and
it reaches recall TF-IDF cannot — 86.2% at a permissive threshold against a
TF-IDF ceiling of 69.0% — because it is the only one that sees across
languages. It found 14 cross-language duplicates at the chosen setting.

The backend in use is carried into every finding's evidence, and TF-IDF
findings receive lower confidence (0.55 vs 0.85). They are not the same
instrument and the card must not imply they are.

## The uncomfortable finding, and what it forced

**L4's marginal value on held-out PR-AUC is negative: −0.0256.**

| ablation variant | held-out PR-AUC |
|---|---|
| rules only | 0.096 |
| unsupervised only | 0.039 |
| duplicate only | 0.021 |
| all layers | 0.088 |
| **without duplicate** | **0.114** |

A weight sweep confirmed this is intrinsic, not tuning:

| L4 weight | held-out PR-AUC | duplicate recall@500 |
|---|---|---|
| 0.00 | 0.1140 | 13.3% |
| 0.05 | 0.0970 | 15.7% |
| 0.10 | 0.0885 | 24.8% |
| 0.20 | 0.0781 | 29.0% |

Monotonic in both directions. There is no weight at which L4 is net-positive on
held-out patterns — **because no held-out pattern is textual**. Any weight L4
receives displaces held-out positives from the top of the ranking.

This is not L4 failing. It is held-out PR-AUC measuring *generalisation to
unseen patterns*, which a **targeted** detector trades against by construction.
Judging a duplicate detector on held-out generalisation is judging a metal
detector on its ability to find wood.

## Decision 4 — A third category of evidence

Two categories were not enough once a targeted detector landed. The harness now
reports three:

| category | what it measures | quotable |
|---|---|---|
| **held-out** | generalisation to patterns nobody targeted | yes |
| **rule-visible** | a rule agreeing with its own injector | no — pipeline check |
| **independent corpus** | capability on hand-written data the generator never produced | yes |

L4's justification lives in the third:

> L4 multilingual duplicate detection: ROC-AUC **0.939** vs lexical
> token_set_ratio **0.486** (+0.453) on 36 hand-labelled items — **justified**

That corpus shares nothing with the generator, so the figure is neither
circular nor a generalisation test. It is a direct capability measurement, and
it is where a targeted detector earns its place.

## The governance rule this produced

A test previously asserted "the full stack beats every single layer on held-out
PR-AUC". L4 disproved it, and the test was replaced with the invariant that
actually holds:

> **A layer must either improve held-out generalisation, or carry
> independent-corpus evidence measured on data the generator never produced.
> A layer with neither has not earned its place.**

A second test pins the trade explicitly, so a future change that quietly makes
L4 look free has to come back and read this ADR.

## A robustness bug found in testing

`embed_descriptions` used `min_df=2` unconditionally. Over a handful of
documents that filters every content word and leaves only stopwords — two
unrelated descriptions sharing the word "of" scored a cosine of **1.0**,
because "of" was the entire vocabulary. A real risk in a small district block,
not only in tests. `min_df` now scales with corpus size, and a collapsed
vocabulary is logged.

## Consequences

- Held-out PR-AUC fell from 0.109 to **0.088** with L4 in the stack; the
  rule-visible figure rose from 0.252 to **0.285**. Both are reported.
- L4 runs in 5.2 s on TF-IDF and 28.0 s with the bi-encoder over 19,817 works.
- The pipeline runs TF-IDF by default on the host and the bi-encoder in the
  ml-worker. The difference is visible in every finding, and in confidence.
- Block 13's calibrated fusion should revisit L4's weight with the
  three-category framing in hand rather than optimising a single number.
