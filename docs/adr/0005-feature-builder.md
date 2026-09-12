# ADR 0005 — The Gold feature builder

- **Status:** accepted
- **Date:** 2026-08-29

## Context

Seven detection layers consume the Gold view and nothing else. That makes it
the one place where a definition can be got wrong once and be wrong
everywhere — and, as this block demonstrated, the one place where a bug can
pass every structural check while destroying the signal.

## Decision 1 — Peer-relative, not global

An expensive metro flyover and an expensive rural culvert are not comparable,
and a global threshold flags the wrong one. Cost outlyingness is
`unit_cost_peer_percentile`: a rank within `(sector, work_type, state)`.

Peer groups below `MIN_PEER_GROUP = 5` yield **null, not a number**. "The 99th
percentile of four works" is arithmetic, not evidence, and an investigator
handed it would rightly stop trusting the system. Measured on the 20,000-work
run: 909 peer groups, 595 usable, 96.6% of works receive a percentile.

The same rule applies to concentration — `agency_district_share` and
`agency_hhi` are null for districts with fewer than 10 works — and to
`mp_agency_affinity` for members with fewer than 5.

`unit_cost_vs_sor` is still emitted, but it rests on an assumed benchmark
(finding R-05), so evidence must lead with the percentile and mention the SoR
ratio only as a labelled assumption.

## Decision 2 — Missing is null, never zero

A work with no coordinates gets `geo_in_district = null` and
`geo_method = "unknown"`, not `0`. The difference between "outside the
district" and "we do not know" is the difference between an alert and a
question, and collapsing them manufactures findings.

`data_quality` counts what is absent across the optional columns so fusion can
discount the whole row. On the current run it ranges 0.82–1.00 with a median
of 0.98 — varying, rather than a constant nobody notices is wrong.

`geo_method` records that the containment test used a bounding box rather than
a real polygon. The evidence card must not imply a boundary test that did not
happen.

## Decision 3 — Classical graph analytics in numpy

`agency_centrality` is eigenvector centrality on the MP–agency bipartite
graph, computed by power iteration on `Aᵀ(Av)` — no dense agency-agency matrix,
and no networkx. The detection core must run on numpy and pandas alone
(ADR-0001), and this is the classical baseline any L3 graph model has to beat.

## The bug this block existed to catch

`_geo_features` built its result with `index=work_id` while the value Series
still carried `joined`'s positional index. Pandas **aligned** rather than
assigned, shifting every value by one row.

Nothing structural caught it. The contract validated. Column count, dtypes and
null counts were all correct. But an injected 3.7-degree geographic
displacement read as *identical to the base population*:

| | before fix | after fix |
|---|---|---|
| `geo_in_district`, displaced works | 1.000 | **0.000** |
| `geo_in_district`, the rest | 0.995 | 1.000 |
| distance to centroid, displaced | 37.7 km | **398.7 km** |
| distance to centroid, the rest | 38.4 km | 38.4 km |

`_text_features` had the same defect: descriptions were silently shifted one
row off their own work.

**The lesson is in the test suite, not the fix.** Contract conformance cannot
detect a feature that computes cleanly and carries no signal. Every pattern
now has a separation test asserting the feature discriminates injected works
from the base population, and those are the tests that will catch the next one
of these.

## Verified separation

| pattern | feature | injected | rest |
|---|---|---|---|
| cost_inflation | unit_cost_peer_percentile | 1.000 | 0.512 |
| pre_sanction_payment | has_pre_sanction_payment | 0.957 | 0.003 |
| ghost_work | photo_present | 0.000 | 0.689 |
| advance_without_progress | spend_progress_gap | 75.3 | −0.6 |
| agency_concentration | agency_district_share | 0.760 | 0.261 |
| split_payment | n_payments | 8.0 | 3.0 |
| photo_reuse | phash_duplicate_count | 69.0 | 0.0 |
| year_end_bunching | is_year_end_sanction | 1.000 | 0.051 |
| geographic_displacement | geo_in_district | 0.000 | 1.000 |

## Acceptance, verified

**The contract assertion passes.** 19,817 works × 62 columns, `validate_frame`
returns no problems, and `assert_no_label_leakage` runs before the frame is
returned.

**Fixture and real frame are schema-identical.** Same columns in the same
order, and every dtype kind agrees. This required fixing the fixture: writing
`pd.NA` into a plain `int8` column silently coerces it to float on the parquet
round-trip, so nullable columns now use pandas' `Int8`. A fixture that is not
schema-identical is worse than none — code written against it breaks on the
swap, which is the exact failure the fixture exists to prevent.

## Consequences

- `drishti features` writes `data/out/gold.parquet` in about 11 seconds for
  20,000 works.
- Detectors in Block 6 onward code against Seam A and never read the raw
  synth tables.
- `progress_acceleration` needs three updates and reports 0.0 below that. If a
  temporal model later leans on it, that floor is a property to check rather
  than assume.
