# ADR 0017 — The generator was inflating the headline, and D-09 is partly answered

- **Status:** accepted
- **Date:** 2026-09-03

## Context

A directive arrived restating R-03: never hardcode logic for the held-out
patterns, keep `Rule.__post_init__` raising, and spend the effort on the
unverified rules instead. Verifying the safeguard rather than assuming it
turned up something larger than the safeguard.

## Finding 1 — the declaration guard was only half a guard

`Rule.__post_init__` raises when a rule *declares* a held-out target. It cannot
see one that does the same thing silently:

```python
Rule(code="geo_check", requires=("geo_in_district",),
     predicate=lambda f: f["geo_in_district"] == 0,
     targets=None)                      # constructs fine
```

Measured on the real Gold view, that rule recovers `geographic_displacement` at
recall **1.000**. A promise was being checked; behaviour was not.

`TestNoRuleSilentlyTargetsAHeldOutPattern` now scores every rule against every
held-out pattern and fails above 0.35 — comfortably above the 0.17 that
ordinary incidental overlap reaches, comfortably below targeting. Labels are
read at test time only and never reach a detector, which is what makes the
measurement legitimate rather than the leak it guards against.

## Finding 2 — two honest rules were recovering a held-out pattern anyway

The new gate immediately caught two pairs, and neither was a rule at fault:

| rule | pattern | recall | declares |
|---|---|---|---|
| `sanction_delay_above_peers` | `year_end_bunching` | **0.863** | nothing |
| `pre_sanction_payment` | `year_end_bunching` | **0.737** | `pre_sanction_payment` |

`_inject_year_end_bunching` moved `sanction_date` forward to March of the next
fiscal year and left `recommended_on` and the payments where they were. That
manufactured two violations the pattern does not mean:

| | injected | everything else |
|---|---|---|
| recommendation→sanction lag (median days) | **245** | 62 |
| sanction-delay peer percentile (median) | **1.00** | 0.50 |
| share with a pre-sanction payment | **73.7%** | 0.6% |

R-03 guards the rule side of this failure. It arrived from the generator side,
where nothing was watching.

### The fix, and what it cost

The injector now shifts **every date for the work by the same delta** —
`recommended_on`, the completion dates, every payment and every progress
update. Only the calendar position changes, which is what year-end bunching
actually means. Verified surgical: 100% of injected works still land in March
(days 18–30, vs a 4.8% March base rate), while the lag falls to a median 64
days against 62 elsewhere and pre-sanction payments to 0.0%.

| | before | after |
|---|---|---|
| held-out PR-AUC | 0.1542 (7.3× prevalence) | **0.0407 (1.9×)** |
| P@500 | 17.2% | **6.0%** |
| R@2000 | 51.1% | **38.6%** |
| `year_end_bunching` recall | 0.832 | **0.284** |
| `vendor_round_tripping` | 0.959 | 0.928 |
| `photo_reuse` | 0.439 | 0.378 |
| `geographic_displacement` | 0.275 | 0.275 |
| `progress_reversal` | 0.172 | 0.161 |

The other four patterns barely move, which is the evidence that the change was
surgical rather than broad damage.

**Marginal value moved with it.** `rules` was +0.0766 on held-out PR-AUC and is
now **−0.0262**: much of the rules layer's apparent generalisation was those two
rules catching the artifact. `graph` (+0.0147) and `unsupervised` (+0.0063) now
carry the held-out signal. Rules remains the layer that owns precision on
rule-visible patterns, which is its actual job.

### Why report the drop rather than absorb it

The old figure was measuring the generator. A 7.3× lift that evaporates when a
date bug is fixed was never a detection claim, and finding that out from a judge
would be considerably worse than finding it out here. The user chose "fix it and
report both", so both are recorded and the artifact page shows the before/after
rather than quietly restating the new number.

The staleness guard closed the loop: with the injector fixed the two recorded
exceptions fell to 0.063 and 0.000, and
`test_the_known_artifacts_are_still_real` failed to say so. `KNOWN_MECHANICAL`
is empty again and both pairs are protected by the gate.

## Finding 3 — D-09 is partly answered, and one constant is worse than unverified

The MPLADS Guidelines were retrieved from the MoSPI CDN and are committed to
`data/guidelines/` with a `SOURCE.md` recording provenance.

**Read the edition.** The file sits under a `/uploads/2023/` path and the
project had been citing "MPLADS Guidelines 2023" from memory. The document is
the **June 2016** edition. Everything sourced from it is cited as 2016, and the
2023 revision remains unobtained.

| clause | establishes | was |
|---|---|---|
| **Para 2.5** | SC 15% / ST 7.5% of the **annual entitlement** (Rs 75 lakh / Rs 37.5 lakh of Rs 5 crore) | `GUIDELINE_CLAUSE`, "clause not yet verified" |
| **Para 3.12** | works sanctioned **within 75 days** of receipt; rejection within 45 days; model-code-of-conduct periods excluded | `SANCTION_WINDOW_DAYS`, **`ASSUMED`** |
| **Para 3.21.2** | Rs 50 lakh ceiling for assets built **by trusts and societies**, +50% to Rs 75 lakh in tribal areas | not modelled |

Two consequences worth stating plainly.

**The 75 days was right all along.** ADR-0013 removed the sanction-window rule
because the constant was unverified and fired on 36% of the corpus. Para 3.12
says 75 days. The fire rate was the *generator's* lag distribution being
unrealistic, not the clause being wrong — an unverified constant is usually
mis-set, and this one was the exception.

**`PER_WORK_CEILING` is unsupported, not merely unverified.** The guidelines
contain **no general per-work ceiling**. Their ceilings attach to recipient
categories, and aided educational institutions are explicitly subject to "no
ceiling" (Para 3.37). The Rs 25 lakh in the document is Para 2.5.1's *additional
amount for tribal areas only* — a different quantity this constant appears to
have been conflated with. `ceiling_breach` fires on 12.8% of the corpus against
a threshold that does not exist. It stays `ASSUMED` and is now an open item with
a name.

## Decision — the copilot retrieves locally and generates optionally

Blueprint §16.6's copilot, with Gemini as the model rather than a bespoke stack.

**Retrieval always runs.** The corpus is chunked on *clause boundaries*, so a
result can cite "Para 3.12" truthfully, and searched with the project's own
`TfidfLite`. 125 citable clauses, no new dependency, works with no key and no
network.

**Generation is a phrasing layer.** The model is never asked what the guidelines
say — it is handed the clauses retrieval found and asked to phrase them, under a
system instruction that forbids supplying clauses from its own knowledge and
forbids deciding whether anything is fraudulent. Every answer carries its
sources and a `generated_by` field, so a reader knows whether a sentence was
phrased by a model or handed over verbatim.

Without `GEMINI_API_KEY` the endpoint still answers, returning the clauses
themselves. A copilot that invents a guideline is worse than no copilot: the
invention arrives wearing the same authority as the real thing, which is the
failure `domain.Sourced` exists to prevent everywhere else.

## Consequences

- The held-out headline is much weaker and is now measuring detection.
- 862 tests; the eleven-check gate stays green.
- Open: `ceiling_breach` rests on a threshold the guidelines do not contain;
  the 2023 edition is unobtained; `SANCTION_WINDOW_DAYS` is verified but no rule
  consumes it yet, and reinstating one needs a realistic lag distribution first.
