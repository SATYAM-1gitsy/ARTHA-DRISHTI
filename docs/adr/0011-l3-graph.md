# ADR 0011 — L3 network structure, and the ensemble losing to its best layer

- **Status:** accepted
- **Date:** 2026-08-29

## Context

`vendor_round_tripping` sat at **10.9% recall** — near chance — because no
layer modelled payee relationships. It is a held-out pattern, which makes it
the cleanest available test of whether general network analysis generalises.

## Decision 1 — General structural analysis, not a ring detector

`vendor_round_tripping` is held-out, so nothing in L3 may be designed to catch
it. Writing a round-tripping detector would make recall ~1.0 by construction
and destroy one of the five figures in this project that carry a detection
claim — the same reason L0 omits three rules the Blueprint asked for.

L3 therefore computes generic properties of a network: agency-payee
concentration (HHI), payee degree across agencies and districts, local
clustering coefficient, label-propagation community density, and repeat
member-agency-payee combinations. If a closed payee ring scores high on
"closed neighbourhood", that is a general measure catching a specific pattern —
which is exactly what held-out evaluation exists to reveal.

`FORBIDDEN_TARGETS` is asserted by a test, and a second test checks no feature
name contains a held-out pattern name.

All of it in numpy — no networkx — because the detection core runs on numpy
and pandas alone (ADR-0001). Label propagation was chosen over Louvain for
having no resolution parameter to tune and no external dependency; ties break
deterministically, which matters more here than modularity quality.

## The generator was producing a graph with no structure

L3's first run returned **1 community** and clustering confined to
0.415–0.443. Every value was valid, finite, and completely uninformative.

The cause was in the generator, not the detector: payees were drawn uniformly
across the country, producing a median payee that served **39 agencies across
17 states**. That is not a contractor, it is a random draw, and it made the
payee co-occurrence graph near-complete — in a complete graph every node has
the same clustering and there is one community by construction.

Payees are now scoped to a home district, with one work in five going to a
contractor elsewhere in the state so the network is local without being
disconnected:

| | before | after |
|---|---|---|
| payees | 500 | 2,279 |
| agencies per payee (median) | 39 | 5 |
| districts per payee (median) | 28 | 2 |
| states per payee (median) | 17 | 1 |
| communities found | **1** | **26** |
| clustering range | 0.415–0.443 | 0.00–1.00 |

A test now asserts every graph feature has non-zero variance. **A feature can
be present, finite and carry no information at all**, and only a variance check
catches that class of failure.

## Result

`vendor_round_tripping` recall: **10.9% → 28.9%**, at a 3% fire rate. Nothing
in L3 was written for it.

And a larger result. Held-out PR-AUC by ablation variant:

| variant | held-out PR-AUC | P@500 | R@2000 |
|---|---|---|---|
| **graph only** | **0.140** | **21.4%** | **30.2%** |
| rules only | 0.096 | 14.0% | 26.0% |
| unsupervised only | 0.039 | 13.4% | 22.4% |
| duplicate only | 0.021 | 2.2% | 9.1% |
| all layers | 0.093 | 16.8% | 28.3% |

**L3 alone (0.140) beats the full four-layer ensemble (0.093).**

## Why the ensemble loses to its best layer

Not a mystery, and worth stating precisely. Breaking the top 500 down by which
layer drove each work's placement:

| dominant layer | works | held-out | rule-visible |
|---|---|---|---|
| graph | 12 | **50.0%** | 0.0% |
| rules | 234 | 20.9% | 47.0% |
| unsupervised | 233 | 12.4% | 57.5% |
| duplicate | 21 | 0.0% | 90.5% |

`graph` is by far the most productive driver of held-out positives — half of
everything it surfaces — and it drives only **12 of 500** works, because its
fusion weight is 0.10 against rules' 0.30. **The weights are inversely related
to held-out productivity.**

Those weights were set arbitrarily in Block 1 and labelled a placeholder at the
time. They are now demonstrably mis-set.

**They have deliberately not been hand-tuned here.** Adjusting weights until
held-out PR-AUC improves is fitting to the evaluation set, and would convert
the project's only honest metric into one that has been optimised against.
Block 13 should *learn* fusion weights on a proper split.

## What this says about the roadmap

Three separate blocks have now produced the same finding by different routes:

1. Block 8 — L1 improved the fused score only in a narrow band of its
   threshold; broader settings diluted L0.
2. Block 10 — L4's marginal value is negative at every weight, monotonically.
3. Block 11 — the single best layer beats the four-layer ensemble.

The weighted-sum fusion is now the binding constraint on this system, not the
absence of L5 and L6. Adding more layers to a combiner that degrades them makes
the ensemble worse, not better. **Calibrated fusion should come next, before
any further detector.**

## Consequences

- L3 runs in 0.2 s over 19,875 works. The classical baseline a GNN would have
  to beat is now measured: held-out PR-AUC 0.140.
- The payee edge is a proxy: `vendor_id` in the Gold view is the payee on a
  work's *largest* payment, so a ring moving money through smaller payments is
  invisible. Stated rather than papered over.
- Works with no recorded payee score 0.0 at confidence 0.2 — a gap in the
  evidence, not an absence of risk.
- Regenerating the vendor network shifted every baseline slightly. Current
  figures: held-out PR-AUC 0.093 fused, `pre_sanction_payment` recall now
  1.000, `progress_reversal` down to 4.6%.
