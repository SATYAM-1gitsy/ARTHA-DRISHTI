# ADR 0015 — A review block: the pipeline could not run, and one line cost two thirds of a layer

- **Status:** accepted
- **Date:** 2026-09-02

## Context

A code review with three questions attached: does it run, does it overfit, and
is it fast enough. The first answer was no, and it had nothing to do with the
detection engine.

`python -m pytest` on the reference machine: **618 passed, 46 failed, 110
errored**. Every one of the 156 failures traced to a single line:

```
The pyarrow installation is not built with support for the Parquet file format
(DLL load failed while importing _parquet: An Application Control policy has
blocked this file.)
```

Windows Application Control blocks pyarrow's `_parquet` extension module and
nothing else. `import pyarrow` succeeds. `pyarrow.dataset`, `pyarrow.feather`,
`pyarrow.orc` and `pyarrow.csv` all import. Only `_parquet.cp314-win_amd64.pyd`
is blocked — and every stage from `seed` to `eval` persists to parquet, so the
whole pipeline stopped while `drishti doctor` reported a usable environment.

## Decision 1 — `doctor` round-trips, it does not import

`doctor` checked six libraries by importing them. That was exactly the check
that could not catch this: the failure lives one module below the import that
succeeds, and it surfaces 156 test failures away from its cause.

`storage.check_parquet()` writes a one-row frame through pandas and reads it
back, per engine, and `doctor` fails on it. `fastparquet` joins
`requirements.txt` as a documented second engine — not redundant with pyarrow,
because the case being defended against is pyarrow present and half-working.

## Decision 2 — parquet preparation belongs in one place

Making the fallback engine work exposed two type bugs that pyarrow had been
papering over, both real independent of any engine.

**`term_start` did not survive being written.** It is a `datetime.date`, which
pandas holds in an object column of boxed Python values. pyarrow guessed
`date32`; fastparquet refused outright. Neither was correct — reading back the
*pyarrow-written* `silver_mp.parquet` returned

```
term_start sample: 1717459200000000000  <class 'int'>
```

raw nanoseconds in an object column. The value had never round-tripped under
either engine; the guess simply failed louder under the second one.

**`datetime64[s]` is not portable.** pandas 3 infers second resolution from a
column of `date`. fastparquet writes it as milliseconds and then refuses to
read it back — `Cannot losslessly cast '1717459 ms' to s` — so the file
`ingest` wrote could not be opened by `seed`.

`storage.prepare_for_parquet()` now owns both cases plus the all-null-object
case that was already handled inline at two of the four write sites, and all
four go through it. Dates are pinned to `datetime64[ns]`, the unit every engine
agrees on. The in-memory frame is untouched: `date` is the right domain type
for a term start, `ReferenceTables` is a frozen seam, and a test pins it. This
is a persistence concern and it stays at the persistence boundary.

## Decision 3 — measure the ranking the product actually presents

`api.store` orders the queue by `(overall_risk, confidence)`, so a thin lead
never outranks a corroborated finding at the same score. `evaluate.harness`
ranked on `overall_risk` alone. Every number this project quotes described an
ordering no reviewer is ever shown.

The gap is not academic, because L0 emits a handful of discrete scores:

| fused score | works | share | held-out positives |
|---|---|---|---|
| 0.000000 | 13,477 | 67.8% | 140 |
| 0.354284 | 3,445 | 17.3% | 42 |
| 0.323791 | 446 | 2.2% | 18 |

3,445 works — every one of them a single `rules` hit at 0.7 and silence
elsewhere — share one value, and `R@2000` is read from inside that block.

`harness.ranking_score()` builds a **dense rank** over the pair, so works
identical on *both* fields still tie. That matters: `average_precision` breaks
ties pessimistically on purpose, and inventing an order for indistinguishable
works would quietly hand that protection back.

**This is not tuning.** It replaces a measurement of one ordering with a
measurement of the shipped one, and the result was accepted without looking for
a better variant. Tie-order sensitivity was checked first, under 30 random
shuffles of the input: `R@2000` varies 0.4988–0.5108 (sd 0.003) and `P@500` not
at all, so the headline was never fragile — the fix is for coherence, not
because the number was wrong.

### What it changed

| | before | after |
|---|---|---|
| held-out PR-AUC | 0.1549 | 0.1542 |
| P@500 | 17.2% | 17.2% |
| R@2000 | 50.1% | **51.1%** |
| `duplicate_work` recall @2000 | 51.5% | **67.0%** |

`duplicate_work` moves most because L4 firing raises confidence through the
textual evidence family, which sorts those works up inside the plateau. The
queue was already doing this; only the measurement had not been.

### A consequence worth stating

L5 `forecast` is weighted **0** and ADR-0014 says it "does not improve the
ranking". Under the shipped ordering that is not quite true: confidence is
computed from all layers' evidence families including forecast, so a zero-weight
layer still moves the queue. Measured marginal value **+0.0009** — negligible,
and it does not change ADR-0014's conclusion. But "weight 0" and "no influence"
are not the same statement, and the difference was invisible while the harness
ranked on risk alone.

## Decision 4 — one line was two thirds of L3

`_local_clustering` counted triangles as `diag(A³)` via

```python
np.einsum("ij,jk,ki->i", binary, binary, binary) / 2.0
```

`einsum` without `optimize` contracts three operands in one naive pass and
never reaches BLAS. On the real payee graph — **2,279 nodes**, not the
"hundreds" the docstring claimed — that is 29.5 seconds. The identical
`np.sum(A * (A @ A), axis=1)` is 0.13 seconds. Output compares
`np.array_equal` **True**, max absolute difference **0.0**.

| | before | after |
|---|---|---|
| L3 graph layer | 43.9s | **0.38s** |
| `score_population` over 19,875 works | 63.5s | **20.4s** |

## Decision 5 — ablation runs each detector once

`_ablation` scored eleven variants — five alone, the full stack, five
leave-one-out — and re-ran every detector in each. Seam B requires a layer to
read only the Gold view, so its output cannot depend on which other layers are
in the subset: eleven passes were computing the same answers eleven times.

Detectors now run once and the variants re-fuse cached `LayerOutput`s, which
are frozen and only read by `assess`. `run_evaluation(with_ablation=True)`
finishes in **68s**; before these two changes it had not finished after 575
seconds of CPU inside the test fixture that calls it. The reported `secs` column
still sums each variant's detector cost, so it keeps meaning "what this variant
would cost to run" rather than silently becoming fusion-only time.

## Decision 6 — the silent fallback named in the handoff

`evaluate_independent()` caught `ImportError` and returned `[]`. L4's only
quotable justification lives in that category (ADR-0010), and a reader saw
`"independent": []` with no way to separate "measured, found nothing" from
"never ran" — opposite conclusions about whether a targeted layer has earned
its weight. The reason now travels with the result, into `metrics.json` and the
rendered report.

## Declined

**Sharpening `is_year_end_sanction`.** Its Seam A description said "final 30
days of the fiscal year"; the code was `month == 3 & day >= 1`, where the second
clause is vacuous. The dead clause is gone and the description now says what the
column has always meant — all of March. The column itself does not move:
`year_end_bunching` is held out, and tightening a feature against a held-out
pattern is the targeting R-03 exists to forbid.

**`UP042`, `str, Enum` → `StrEnum`.** These enums are written into parquet
columns, JSON evidence cards and Seam D payloads, and `str, Enum` is what makes
a member serialise as its bare value. The swap is a silent change to persisted
data shapes for no behavioural gain. Ignored in `pyproject.toml` with the
reason, rather than left as a standing lint failure.

**Further optimisation.** After L3, the profile is rules 9.1s, duplicate 5.6s,
unsupervised 4.4s over 19,875 works — no remaining hot spot, only per-row pandas
access worth a second or two at the cost of touching three detectors. Stopped.

## Three things only running it could find

The suite was green and the gate passed before any of these were visible. They
came out of opening the prototype and reading one evidence card.

**HMR was dead in the containerised frontend.** `docker-compose` bind-mounts
`./frontend` into a Linux container, and a write from the Windows host raises no
inotify event inside it. Vite's watcher never fired: the file was on disk, the
container could `cat` it, and the browser kept serving the module graph built at
container start. Every frontend edit under `drishti up` silently did nothing.
`vite.config.ts` now enables polling when `VITE_USE_POLLING` is set, and compose
sets it — confirmed by `[vite] hmr update /src/App.tsx` appearing for the first
time.

**The footer described a system three blocks out of date.** It read "Block 7 ·
vertical slice" and "L0 rules only — L1–L6 land in later blocks", on a screen
whose evidence card was at that moment displaying `network` findings from L3 and
peer-relative findings from L1.

**A reason no investigator could act on.** L1 phrases findings as multiples of
the peer median, which stops working when the two numbers have opposite signs:

> The time to the first payment is **-1.68x the median** of 62 comparable works

The value is −101 days — this work was paid 101 days *before* sanction, which is
the pre-sanction payment the CRITICAL rule above it already names — against a
peer median of +60 days. A negative multiple of an interval is arithmetic, not
evidence. The ratio forms now require a positive ratio and the absolute form
carries the finding instead:

> The time to the first payment is **-101.00, against a median of 60.00** across
> 62 comparable works …

`in the top 1.6% of that group` became `in the most extreme 1.6%` in the same
pass: `ecdf_tail` is two-sided, so a low-side outlier was being announced as
"top". Both are text-only — `drishti score` reproduces the identical band counts
(285 / 881 / 4,248 / 14,461, 1,047 actionable) before and after.

## The question that had not been asked

Every number the project reports comes from the seed-42 dataset it was built
against. Whether the performance belonged to the detectors or to that sample
had never been tested. Same code, generator seed **1234**, isolated data
directory:

| | seed 42 (development) | seed 1234 (never seen) |
|---|---|---|
| held-out PR-AUC | 0.1542 (7.3× prevalence) | **0.1617 (7.7×)** |
| P@500 | 17.2% | **17.4%** |
| R@2000 | 51.1% | 48.9% |

Marginal value per layer moves by hundredths and **no layer changes side**:
rules +0.0766 → +0.0853, graph +0.0284 → +0.0271, unsupervised +0.0102 →
+0.0264, forecast +0.0009 → +0.0007, duplicate −0.0063 → −0.0137. Ten of the
eleven acceptance checks pass there; the eleventh wants `data/fixtures/`, which
the isolated directory does not have.

Held-out performance on unseen data is marginally *better* than on the
development sample. The layered design, the held-out split and the untuned
weights were doing what they were built to do, and now there is a measurement
saying so rather than an argument.

## Consequences

- `drishti doctor` fails loudly on a machine that cannot persist, instead of
  reporting health and letting the next command fail three layers down.
- The quoted numbers describe the queue an investigator is shown.
- `drishti eval` is usable interactively, and the test fixture that calls it no
  longer dominates the suite.
- The lint gate is green, so it can be enforced in CI.
- **Nothing here was fitted to the evaluation set.** Weights are unchanged from
  Block 1, calibration still reads score distributions only, and the two
  measurement changes (ranking key, detector caching) were adopted for
  correctness with their effect reported afterwards rather than selected for it.
