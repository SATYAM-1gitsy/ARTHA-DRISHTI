# ARTHA DRISHTI — session handoff

**Read this first if you are picking the project up cold.** It is the single
file that carries the project's state, its rules, and its measured numbers
across sessions. Everything here was verified on 2026-09-02, not recalled.

---

## 1. What this is

An AI-powered anomaly, fraud and compliance risk-intelligence platform for the
MPLAD Scheme. Smart India Hackathon 2026, problem statement **SIH26102**,
Ministry of Statistics and Programme Implementation.

The system ingests MPLADS records, runs a layered detection engine over them,
fuses the layers into one explainable risk score per work, and serves
prioritised, human-reviewable alerts.

> **It flags works for review. It never issues a verdict.**
> A rule violation is not an anomaly. An anomaly is not fraud. A model
> probability is not a legal conclusion. Every screen, endpoint and evidence
> card preserves those distinctions, and so must every change.

**Repository location: `C:\dev\artha-drishti`** — deliberately outside the home
directory. `C:\Users\DELL` is itself a stray git repo with a public GitHub
remote and no `.gitignore`; building there risked publishing `AppData`,
`.claude.json` and `.docker/`. That stray repo still exists and is still worth
deleting (it has zero commits and zero tracked files, so nothing is lost).

---

## 2. Run it

```bash
cd C:/dev/artha-drishti
cp .env.example .env                # if .env is missing
pip install -r backend/requirements.txt
pip install -e .                    # puts `drishti` on the path -- see below
python -m drishti doctor            # environment check
python -m drishti e2e               # ingest -> seed -> features -> score -> gate
```

**`python -m drishti` only works if the package is importable.**
`pyproject.toml` maps the package to `backend/`, and its
`pythonpath = ["backend"]` covers **pytest only**. Without `pip install -e .`
the repo root gives you `No module named drishti`. The alternatives are
`cd backend` first, or setting `PYTHONPATH=backend` (both verified working).

Run from the repo root. Paths are anchored to the repo itself
(`config._anchor`), so a relative `DRISHTI_DATA_DIR` no longer follows the
working directory — but `docker compose` and relative arguments still assume
root.

`e2e` ends with an eleven-check acceptance gate. If it says **"All checks passed.
The vertical slice is green."** the project is healthy. The eleven checks are the
invariants a change is most likely to break:

1. gold view matches the Seam A contract
2. fixture is schema-identical to the real frame
3. no ground-truth leakage into features
4. fusion emits four separate quantities in [0, 1]
5. risk and confidence are not the same number
6. missing fields lower data quality
7. one evidence family is a lead, not a case
8. injected pre-sanction payments rank in the top 10%
9. API payloads validate against the Seam D contract
10. every finding carries provenance
11. the review queue stays a reviewable size

Full stack with UI:

```bash
python -m drishti up -d             # postgres, redis, api, ml-worker, mlflow, frontend
```

| service | port | notes |
|---|---|---|
| frontend | 5173 | React + Vite. District queue and evidence card |
| api | 8000 | FastAPI. **No GPU by design** — it enqueues, it does not train |
| ml-worker | — | GPU Celery worker. CUDA and sentence-transformers live here |
| mlflow | 5000 | Experiment tracking, Postgres-backed |
| postgres | 5432 | PostgreSQL 16 + PostGIS 3.4 |
| redis | 6379 | Celery broker |

Docker Desktop must be running. Everything except the databases also runs
natively, so a broken Docker install never blocks anyone.

### Commands

| command | does |
|---|---|
| `drishti doctor` | environment check (python, GPU, docker, data) |
| `drishti gpu [--require]` | accelerator report |
| `drishti contracts` | print the frozen seams |
| `drishti ingest [--postgres]` | load the real allocation file, bronze → silver |
| `drishti seed [--n-works N]` | generate synthetic data + ground truth |
| `drishti features` | build the Gold feature view |
| `drishti score` | run detectors + fusion, publish API payloads |
| `drishti eval [--no-ablation]` | evaluate, with layer ablation |
| `drishti e2e` | the whole chain + acceptance gate |
| `drishti copilot [question]` | check the copilot's two halves, or ask it something |
| `drishti test` | 888 tests; 10 skip on the host (9 need `sentence-transformers`, which ships only in the ml-worker; 1 exercises a no-GPU path) |
| `drishti jobs gpu_probe` | prove CUDA works where training happens |

### GPU

The default `pip install torch` is **CPU-only on Windows**. It imports fine and
silently trains everything on CPU.

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu130
```

Machine: RTX 5070 **Laptop** GPU — Blackwell, `sm_120`, **8 GB** (not the
desktop 12 GB). `sm_120` kernels ship only in CUDA 12.8+ builds; `cu121`/`cu124`
install happily then fail at the first kernel launch.

---

## 3. Layout

```
backend/drishti/
  config.py       paths, seeds, fusion weights, band thresholds, GPU settings
  domain.py       MPLADS constants — every one carrying provenance
  util.py         numeric substrate: robust stats, ECOD core, union-find, geo
  textsim.py      multilingual normalisation, lexical similarity, TF-IDF
  gpu.py          accelerator detection + the CPU-build guard
  contracts/      THE FIVE SEAMS — read before changing anything
  ingest/         bronze: read the real file, judge nothing
  transform/      silver: canonicalise, resolve entities, record every repair
  synth/          generator + injector (kept separate on purpose)
  features/       Seam A producer: the Gold view
  detect/         rules (L0), unsupervised (L1), graph (L3), duplicates (L4),
                  forecast (L5, weight 0)
  score/          Seam C: fusion (`combine.py` holds the arithmetic)
  evaluate/       the harness + metrics
  encoders/       GPU multilingual bi-encoder
  api/            FastAPI, store, routers, publish
  acceptance.py   the eleven-check gate
frontend/         React + TypeScript + Vite
data/raw/         the one real file (committed)
data/seeds/       generated (git-ignored)
data/out/         gold.parquet, risk_score.parquet, metrics.json (git-ignored)
data/fixtures/    committed samples that unblock parallel work
docs/adr/         0001–0011, the decision record
```

---

## 4. The five seams

Frozen in Block 2. Changing one is a three-part commit — contract, fixture, and
every producer/consumer — landed together so `main` never goes red.
`drishti contracts` prints them.

| seam | what | module |
|---|---|---|
| **A** | Gold feature view — one row per `work_id`, 68 columns | `contracts/gold.py` |
| **B** | Layer output — identical across L0–L6 | `contracts/layer.py` |
| **C** | Risk assessment + evidence card | `contracts/risk.py` |
| **D** | REST response shapes | `api/models.py` |
| **E** | Ground truth, and where it may not flow | `contracts/labels.py` |

Every detector exposes `run(features, ctx) -> list[LayerOutput]`, reads **only**
the Gold view, and emits **one row per work including silent ones**. No layer
reads another layer's output; fusion is the only place they combine.

**Four quantities are kept separate and must stay separate:**
`overall_risk` (how concerning), `confidence` (how well evidenced),
`severity` (consequence if true), `data_quality` (input completeness).
Collapsing them makes a thin lead and a corroborated finding look identical.

---

## 5. The rules that must not be broken

These are enforced by tests. If a test in this list fails, the fix is almost
never to relax the test.

### R-03 — held-out patterns are sacred

Thirteen fraud patterns split into **rule-visible** (8) and **held-out** (5).
No detector may be written against a held-out pattern. Held-out figures are the
only ones in this project that carry a detection claim; rule-visible recall
measures a rule agreeing with its own injector.

**Held-out:** `vendor_round_tripping`, `year_end_bunching`,
`geographic_displacement`, `progress_reversal`, `photo_reuse`.

Consequences already accepted: L0 deliberately omits three rules the Blueprint
asked for (`geo_outside_district`, year-end, duplicate-photo). L3 is written as
general network analysis, not a ring detector. `Rule.__post_init__` raises if
`targets` names a held-out pattern.

`EvaluationReport.pooled_metrics()` raises rather than returning a number.

### R-01 — corroboration counts evidence families, not layers

Six families: financial, temporal, network, textual, asset, compliance. Three
layers firing on `unit_cost` is **one** financial observation seen three ways,
not three confirmations. Confidence is computed from independent families.

### R-05 / R-06 — provenance travels with every number

`domain.Sourced` carries value + provenance + citation. Every rule and every
benchmark declares whether it came from a guideline clause, a CAG finding, the
data itself, or a **project assumption**. Four of ten L0 rules are assumptions
today, and the UI renders them as such. Cost evidence leads with the
peer-derived percentile, never the invented Schedule-of-Rates ratio.

### The layer-justification rule (added in Block 10)

> A layer must either improve held-out generalisation, **or** carry
> independent-corpus evidence measured on data the generator never produced.
> A layer with neither has not earned its place.

Three categories of evidence, and they are not interchangeable:

| category | measures | quotable |
|---|---|---|
| held-out | generalisation to untargeted patterns | yes |
| rule-visible | a rule agreeing with its injector | no — pipeline check |
| independent corpus | capability on hand-written data | yes |

### Never fit to the evaluation set

Fusion weights have **not** been hand-tuned to held-out PR-AUC, deliberately,
and are still the Block 1 values. Doing so would convert the only honest metric
into one optimised against. Block 13 improved fusion by 50% by changing the
*arithmetic*, which can be justified without reference to the answer.

When a design decision unavoidably reads held-out labels — Block 13's did, to
diagnose — report **mean pattern lift** beside it. Each held-out pattern scored
alone with the other four removed, averaged: a gain carried by one pattern
leaves it flat. `drishti eval` prints it per combiner.

---

## 6. Where the numbers actually stand

Measured on 19,875 works, layers `rules + unsupervised + graph + duplicate`,
combiner `calibrated_noisy_or` (Block 13).

**Held-out (quotable):** PR-AUC **0.0407** (1.9× prevalence),
P@500 **6.0%**, R@2000 **38.6%**.

> ### These numbers fell sharply in Block 18, and the fall is the honest part.
>
> Before: PR-AUC 0.1542 (7.3×), P@500 17.2%, R@2000 51.1%.
> After fixing `_inject_year_end_bunching`: **0.0407**, **6.0%**, **38.6%**.
>
> The injector moved `sanction_date` forward to March without moving
> `recommended_on` or the payments, manufacturing an inflated sanction lag and
> retroactively pre-sanction payments. Two rules that target nothing were
> recovering the pattern at 0.863 and 0.737 off those artifacts.
> `year_end_bunching` recall was **0.832**; with the timeline shifted whole it
> is **0.284**. The system never detected year-end bunching. It was detecting
> the generator. ADR-0017.

**Rule-visible (pipeline check, not a claim):** PR-AUC 0.308, P@500 55.8%.

Re-measured in Block 16 after the harness was corrected to rank works the way
the queue presents them — `(overall_risk, confidence)`, not `overall_risk`
alone. See ADR-0015. PR-AUC moved 0.1549 → 0.1542, R@2000 50.1% → 51.1%.

Per held-out pattern (recall @2000):

| pattern | recall | found | before B13 |
|---|---|---|---|
| pattern | recall | note |
|---|---|---|
| vendor_round_tripping | **92.8%** | (Block 18) |
| photo_reuse | **37.8%** | (Block 18) |
| year_end_bunching | **28.4%** | (Block 18) |
| geographic_displacement | **27.5%** | (Block 18) |
| progress_reversal | **16.1%** | (Block 18) |

`year_end_bunching` fell 83.2% → 28.4% when its injector stopped manufacturing
two unrelated violations. The other four moved by a point or two.

Read the denominators carefully: these count **pattern instances**, 468 across
417 distinct works, because 51 works carry more than one held-out pattern.
Overall `R@2000` counts distinct works. The two do not sum, and they are not
interchangeable — a change can raise one and lower the other.

Rule-visible recall, for pipeline health only — **do not quote these**:
`pre_sanction_payment` 100%, `split_payment` 82.6%, `duplicate_work` 67.0%,
`cost_inflation` 57.9%, `ghost_work` 43.6%, `ineligible_work` 39.8%,
`agency_concentration` 32.8%, `advance_without_progress` 29.6%.
(`duplicate_work` rose 51.5% → 67.0% under the corrected ranking: L4 firing
raises confidence through the textual family, which sorts those works up inside
the large tied block. The queue always did this; only the measurement had not.)

Combiners — same layer outputs, same weights, only the arithmetic varies.
`drishti eval` reprints this every run:

| combiner | PR-AUC | P@500 | R@2000 | mean pattern lift |
|---|---|---|---|---|
| **calibrated_noisy_or** (in use) | **0.0407** | 6.0% | **38.6%** | **2.6×** |
| weighted_mean (Block 2) | 0.0293 | 5.6% | 15.1% | 1.7× |
| noisy_or | 0.0284 | 4.6% | 15.1% | 1.6× |

**Mean pattern lift is the honest column.** Block 13's design was informed by
held-out labels, so its held-out PR-AUC is optimistically biased. That column is
leave-one-pattern-out — each pattern scored alone, the other four removed — and
all five improved individually, so the gain is not one pattern carrying the rest.
The calibrated combiner still wins on every column; the *margin* fell with
everything else when Block 18 removed the injector artifact.

Ablation, held-out PR-AUC, current:

| variant | PR-AUC | P@500 | R@2000 |
|---|---|---|---|
| **graph only** | **0.140** | **21.4%** | 30.2% |
| without rules | 0.067 | 9.2% | **40.8%** |
| without duplicate | 0.042 | 6.0% | 37.9% |
| **all layers** (in use) | **0.041** | **6.0%** | **38.6%** |
| without forecast | 0.040 | 6.0% | 37.6% |
| unsupervised only | 0.038 | 9.8% | 17.7% |
| without unsupervised | 0.034 | 3.6% | 30.0% |
| without graph | 0.026 | 3.4% | 19.4% |
| rules only | 0.021 | 1.8% | 9.4% |
| duplicate only | 0.021 | 2.2% | 9.1% |
| forecast only | 0.021 | 3.2% | 10.6% |

Marginal value, and note the sign change on `rules`:

| layer | Block 12 | Block 13 | Block 14 | Block 16 | **Block 19** |
|---|---|---|---|---|---|
| graph | +0.007 | +0.021 | +0.028 | +0.028 | **+0.0147** |
| unsupervised | +0.007 | +0.017 | +0.007 | +0.010 | **+0.0063** |
| forecast | — | — | — | +0.001 | **+0.0007** |
| duplicate | −0.015 | −0.007 | −0.007 | −0.006 | **−0.0017** |
| rules | +0.020 | +0.064 | +0.080 | +0.077 | **−0.0262** |

> ### The ensemble now loses to its own best layer, and this is the open problem
>
> `graph only` scores held-out PR-AUC **0.140** and **P@500 21.4%**. The full
> stack scores **0.041** and **6.0%**. An investigator's first page is three
> and a half times better with L3 alone than with everything switched on.
>
> The cause is measurable and is not a bug in any layer. Fire rate, mass share
> and held-out hit rate, over 19,875 works:
>
> | layer | weight | fire rate | share of fused mass | held-out rate when it fires |
> |---|---|---|---|---|
> | rules | 0.30 | 27.2% | **75.3%** | **2.19%** |
> | unsupervised | 0.20 | 2.6% | 10.8% | 9.62% |
> | graph | 0.10 | 3.0% | 6.9% | **17.89%** |
> | duplicate | 0.10 | 3.0% | 6.9% | 1.82% |
>
> Base held-out rate is **2.10%**. `rules` owns three quarters of the score and
> fires at the base rate — it is at chance on patterns nobody wrote it against,
> which is exactly what it should be, since it is a compliance engine and not a
> statistical detector. `graph` carries 8.5× the base rate on 6.9% of the mass.
>
> This is ADR-0012's pathology returning by a different route. Block 13 fixed it
> by calibrating; Block 18 then removed the artifact that had been making
> `rules` look predictive (two rules were recovering `year_end_bunching` at
> 0.863 and 0.737 off a manufactured sanction lag), and the honest number
> underneath is negative.
>
> **Do not fix this by retuning the weights.** They are unchanged from Block 1
> on purpose, and tuning them against held-out PR-AUC fits the only honest
> metric the project has — the exact failure §5's "never fit to the evaluation
> set" rule exists to prevent. The rule-visible numbers (P@500 **59.8%**,
> `pre_sanction_payment` recall 1.000) say L0 is doing its actual job, and a
> rule hit is a documentary fact with a citation, which is worth something no
> ranking metric scores. What is genuinely open is whether L0 should feed the
> *ranking* at weight 0.30 as well as feeding the evidence card. Answering that
> honestly needs a criterion decided before the number is looked at.

Agreement still works and is still the strongest signal in the system:

| weighted layers firing | works | held-out rate |
|---|---|---|
| 0 | 13,451 | 1.36% |
| 1 | 5,772 | 3.21% |
| 2 | 610 | **7.54%** |
| 3 | 39 | 7.69% |

`forecast` is weighted **0** and still shows a marginal value, which is not a
contradiction: confidence is computed from every layer's evidence families, and
the queue's secondary sort is confidence, so a zero-weight layer still nudges
the ordering. +0.0007 is negligible and ADR-0014's conclusion stands — but
"weight 0" and "no influence on the ranking" are different statements, and the
difference was invisible while the harness ranked on risk alone. ADR-0015.

`duplicate` is still net-negative and that is expected, not a bug: no held-out
pattern is textual, and L4's justification lives in the independent-corpus
category (ADR-0010).

Independent corpus: L4 duplicate detection ROC-AUC **0.939** vs lexical
baseline **0.486** on 36 hand-labelled items — justified (ADR-0010).
**This figure is not in the current `metrics.json`** — `independent` is `[]`
there, because `sentence-transformers` is absent on the bare host. The encoder
ships in the ml-worker, so reproduce it there:

```bash
python -m drishti jobs evaluate_l4
```

That fallback used to be **silent**, which was the wart recorded here. Fixed in
Block 16: `metrics.json` now carries `independent_unavailable` and the rendered
report prints the reason, so "measured, found nothing" and "never ran" are no
longer the same empty list. ADR-0015.

### Generalisation to unseen samples (re-measured, Block 19)

Every figure above is measured on the seed-42 dataset the pipeline was
developed against, which leaves the question that matters most: is the
performance a property of the detectors, or of that particular sample?
Re-run whole, same code, two generator seeds the project has never scored,
each in an isolated data directory:

| | seed 42 (development) | seed 1234 (unseen) | seed 2026 (unseen) |
|---|---|---|---|
| works | 19,875 | 19,905 | 19,815 |
| held-out prevalence | 2.10% | 2.09% | 2.09% |
| held-out PR-AUC | 0.041 (1.9×) | **0.041 (2.0×)** | **0.039 (1.9×)** |
| P@500 | 6.0% | **6.6%** | **5.4%** |
| R@2000 | 38.6% | **38.6%** | **37.6%** |
| rule-visible PR-AUC | 0.376 | 0.328 | — |

Marginal value per layer — **every verdict identical, and no layer changes
sign**:

| layer | seed 42 | seed 1234 | seed 2026 |
|---|---|---|---|
| graph | +0.0147 | +0.0147 | +0.0148 |
| unsupervised | +0.0063 | +0.0088 | +0.0044 |
| forecast | +0.0007 | +0.0005 | +0.0006 |
| duplicate | −0.0017 | −0.0021 | −0.0017 |
| rules | −0.0262 | −0.0280 | −0.0230 |

**Nothing is fitted to the development sample.** Held-out performance on data
the pipeline has never seen matches seed 42 within noise on every headline
figure, and the per-layer ordering is stable to three decimal places on
`graph`. The acceptance gate passes 10 of 11 on both unseen seeds; the
eleventh is the fixture-schema check, which needs `data/fixtures/` and is a
missing file rather than a pipeline problem.

That cuts both ways, and the second half is the important one: **the ensemble
degradation above is structural, not a seed-42 artifact.** `graph only` beats
`all layers` on all three samples (0.140 / 0.131 / 0.186 against 0.041 / 0.041
/ 0.039), and `rules` marginal value is negative on all three. A finding that
reproduces on two unseen samples is not noise to be explained away.

Reproduce with:

```bash
DRISHTI_DATA_DIR=/some/empty/dir DRISHTI_SEED=1234 python -m drishti e2e
DRISHTI_DATA_DIR=/some/empty/dir DRISHTI_SEED=1234 python -m drishti eval
```

(Copy `data/raw/*.xlsx` into `<dir>/raw` first. The acceptance gate's
fixture-schema check fails there for want of `data/fixtures/`, which is a
missing file rather than a pipeline problem.)

Calibration: Brier **0.0728**, mean predicted 0.138 vs observed 0.070, still
flagged over-confident. Block 13 pushed this the wrong way (0.0631 → 0.0836)
because `1 - prod q^w` produces larger values; Block 14 pulled most of it back
by removing 7,177 near-base-rate flags. The fused score remains a **priority
ordering, not a probability** — the evidence card renders it as `0.62` under
"how concerning this looks", never as a percentage.

---

## 7. What is built

| block | what | state |
|---|---|---|
| 0 | Repository, data, compute, model-readiness audit | ADR-0001, 0002 |
| 1 | Repo, foundation modules, walking skeleton | done |
| 1b | GPU ml-worker, MLflow, Celery | done |
| 1c | GPU multilingual encoder | done |
| 2 | The five seams frozen, fixtures committed | ADR-0003 |
| 3 | Ingest the real allocation file, bronze → silver | done |
| 4 | Synthetic generator anchored to the real spine | ADR-0004 |
| 5 | Gold feature builder, 68 columns | ADR-0005 |
| 6 | L0 rules with provenance | ADR-0006 |
| 7 | Thin fusion, read API, District queue, acceptance gate | ADR-0007 |
| 8 | L1 peer-relative anomaly detection | ADR-0008 |
| 9 | Evaluation harness with held-out reporting | ADR-0009 |
| 10 | L4 multilingual duplicates | ADR-0010 |
| 11 | L3 network structure | ADR-0011 |
| 13 | Calibrated fusion | ADR-0012 |
| 14 | L0 selectivity | ADR-0013 |
| 15 | L5 temporal (built, **weight 0**) | ADR-0014 |
| 16 | Review block: parquet portability, ranking alignment, L3 230x | ADR-0015 |
| 17 | Product surface: 4 dashboards, RBAC, review workflow, audit log | ADR-0016 |
| 18 | Injector artifact fixed, D-09 sourced, Gemini copilot | ADR-0017 |
| 19 | Review block: L1 percentile inversion, copilot diagnosis, copilot UI, three-seed generalisation | this file |

Not built: **L2 supervised**, **L6 vision**, the GenAI copilot, maps and
choropleths, drift monitoring.

Built in Block 17 (ADR-0016): all four Blueprint §11 dashboards, 15 of 16 §10
endpoints, RBAC with jurisdiction scoping, the append-only review workflow and
audit log, and the SC/ST earmark compliance report. The copilot is blocked on
open question D-09 — RAG over a Guidelines document that does not exist.

**L5 is built but weighted 0.** Marginal value −0.0058 on held-out PR-AUC, and
no independent-corpus evidence, so by ADR-0010's rule it has not earned a
weight. It still runs and still emits reasons for the evidence card —
"still incomplete 1,200 days after sanction, where only 2% of comparable works
were still running" helps a reviewer even when it does not improve ranking.
Do **not** turn it on without independent-corpus evidence first (ADR-0014).

L6 vision and document intelligence have **no input at all** — there are no
images and no documents. They can be designed, not built (ADR-0002).

---

## 8. What to do next

Three blocks took held-out PR-AUC from 0.093 to 0.155 without adding a working
detector: Block 13 fixed how evidence combines, Block 14 cut L0's noise, and
Block 15 built L5 and then benched it for not earning its place.

**That pattern is the signal.** The last two things that helped were repairs,
not additions, and the last thing added did not help. Block 16 was repairs
again — it found the pipeline unable to run at all on this machine, and one
line costing two thirds of a layer. Reach for another layer only with a
specific reason to expect it to beat the two open problems below.

**The plateau is worth understanding before attacking the head of the queue.**
L0 emits a handful of discrete scores, so the fused score does too:

| fused score | works | share | held-out positives |
|---|---|---|---|
| 0.000000 | 13,477 | 67.8% | 140 |
| 0.354284 | 3,445 | 17.3% | 42 |

67.8% of the corpus scores exactly zero because no weighted layer fired on it,
and those works hold **140 of the 417 held-out positives**. No queue of any
depth can reach them, so recall is capped around 66% before ranking quality
enters the picture. The 0.354284 block is 3,445 works that are each a single
`rules` hit at 0.7 with silence everywhere else — genuinely indistinguishable
on current evidence, not mis-ordered. Both are evidence-coverage problems
rather than ranking problems, which is a different thing to fix from P@500.

0. **The ensemble loses to `graph` alone, on three independent samples.**
   `graph only` scores held-out PR-AUC 0.140 / 0.131 / 0.186 and P@500 ~20%;
   the full stack scores 0.041 / 0.041 / 0.039 and P@500 ~6%. `rules` holds
   **75.3% of the fused score mass** and fires at the base rate on held-out
   patterns. This is now the largest single gap between what the system can do
   and what it does, and it sits directly on top of problem 2 below.

   **It cannot be fixed by retuning weights** — §5 forbids fitting them to
   held-out PR-AUC, and doing so would destroy the only honest metric here.
   What *is* legitimate: decide, on stated grounds and before looking at the
   number, whether L0 belongs in the *ranking* at all or only in the evidence
   card. It is a compliance engine producing documentary facts with citations;
   its rule-visible P@500 is 59.8% and `pre_sanction_payment` recall is 1.000.
   Those are real and they are not what held-out PR-AUC measures. The two jobs
   — "rank the queue" and "state what was violated" — may simply want different
   weights, and separating them is a design change rather than a tuned constant.

1. **D-09, the guidelines document.** Two rules still rest on unverified
   `ASSUMED` constants — `PER_WORK_CEILING` (12.8% fire rate) and
   `SPLIT_PAYMENT_CEILING_BAND`. Block 14 measured what an unverified constant
   costs: a 75-day window nobody checked was generating 36% of all flags. This
   is the highest-value open item in the project.
2. **The head of the ranking.** P@500 has moved 16.8% → 17.2% across three
   blocks while R@2000 went 28.3% → 50.1%. Every gain has been in the body of
   the queue. The first page an investigator sees is still ~83% false
   positives, and nothing tried so far has touched it. Worth attacking
   directly rather than hoping a new layer fixes it.
3. **L2 supervised** — defensible now that fusion no longer degrades what it is
   given, and the only major layer left with a plausible route to the head of
   the ranking. It must train on an explicit documented split and must never
   see held-out patterns.
4. Alert/review workflow, RBAC, drift monitoring — product surface, not
   detection.

Not worth doing: re-tuning fusion weights. They are unchanged from Block 1 on
purpose, and tuning them against held-out PR-AUC fits the only honest metric
the project has.

Not worth doing: turning L5 on. See ADR-0014 — it needs independent-corpus
evidence first, and building that corpus *in order to* justify the layer would
be motivated reasoning.

---

## 9. Gotchas already paid for

Do not rediscover these.

- **A library can import and still be broken.** `import pyarrow` succeeds on
  this machine and `import pyarrow.parquet` raises — Windows Application
  Control blocks that one extension module, `_parquet.pyd`, and nothing else in
  the package. Every stage from `seed` to `eval` persists to parquet, so the
  whole pipeline stopped while `doctor` reported a usable environment and the
  suite showed **156 failures** pointing at pandas. `doctor` now round-trips a
  real frame; `fastparquet` is a documented second engine in
  `requirements.txt`. Check the capability, never the import.
- **An object column of `datetime.date` does not round-trip.** pyarrow guesses
  `date32`, fastparquet refuses outright, and the pyarrow-written
  `silver_mp.parquet` read `term_start` back as `1717459200000000000` — raw
  nanoseconds, in an object column. Dates are normalised to `datetime64[ns]` at
  the write boundary by `storage.prepare_for_parquet`. Not `[s]`: pandas 3
  infers second resolution from a `date`, and fastparquet writes it as ms then
  refuses to read it back.
- **`np.einsum` without `optimize=True` does not reach BLAS.** Counting
  triangles as `np.einsum("ij,jk,ki->i", A, A, A)` cost **29.5s** on the
  2,279-node payee graph against **0.13s** for the identical
  `np.sum(A * (A @ A), axis=1)` — 230x, and two thirds of the whole L3 layer.
  If a numpy line is slow, check whether it is silently doing an O(n³) loop.
- **A docstring's scaling assumption ages.** That einsum was written when the
  comment said "payee counts are in the hundreds". They are 2,279.
- **The containerised frontend does not hot-reload without polling.** A write
  from the Windows host raises no inotify event inside the Linux container, so
  Vite's watcher never fires: the file is on disk, the container can read it,
  and the browser keeps serving the module graph from container start. Every
  frontend edit under `drishti up` silently did nothing. `VITE_USE_POLLING` in
  `docker-compose.yml` fixes it; `docker logs artha-drishti-frontend-1` should
  show `[vite] hmr update` after an edit.
- **A peer-relative multiple breaks when the signs differ.** L1 rendered a
  pre-sanction payment as "-1.68x the median" — value −101 days against a peer
  median of +60. A negative multiple of an interval is not evidence. The ratio
  branches now require a positive ratio.
- **A nullable integer does not survive a mixed-engine round trip.**
  `exif_consistent` is `Int8`; written by fastparquet and read by pyarrow its
  nulls come back `float64`. Values intact, dtype not — enough to fail the
  fixture schema check. `storage.read_gold()` restores the Seam A dtypes.
  Related: **pyarrow's `_parquet` module started importing again** partway
  through the session that documented it as blocked, so do not assume either
  engine is the one in use.
- **An aggregate rule is not a per-work rule.** The SC/ST earmark as a per-work
  predicate fires on 87.1% of the corpus — 17,321 flags for 475 findings —
  because every work inherits its member's portfolio shortfall. Measure the
  fire rate before writing a rule, every time.
- **A queue position is not an identifier.** `alert_id` was a row's position and
  changed on every re-score, so a recorded review would later describe a
  different work. It is the work id now.
- **`.claude/launch.json` attaches, it does not start.** `docker compose up`
  already serves the api on 8000 and the frontend on 5173, so a start command
  there competes for the port instead of helping. Both entries are the attach
  form -- `url` plus `port`, no command -- with `autoPort: false`, because the
  ports are load-bearing: `api/app.py` allows CORS from `http://localhost:5173`
  only and the frontend defaults `VITE_API_BASE_URL` to `http://localhost:8000`.
  Let either be auto-assigned and every browser request fails. Keep the file
  strictly schema-conformant too -- a `"//"` comment key parses as JSON but is
  not a recognised field, and the tooling falls back to a start command when it
  rejects the file, which reproduces the very port clash the attach form exists
  to avoid. If the stack is down: `python -m drishti up -d`.
- **A held-out figure can be inflated by the *injector*, with no rule at
  fault.** `year_end_bunching` recall is 83.2%, and two rules that target
  nothing and were never written against it recover it at 0.863
  (`sanction_delay_above_peers`) and 0.737 (`pre_sanction_payment`).
  `_inject_year_end_bunching` moves `sanction_date` forward to March of the
  *next* fiscal year and leaves `recommended_on` and the payments where they
  were, so it manufactures two unrelated violations: the sanction lag jumps to
  a median 245 days against 62 elsewhere (100th peer percentile), and 73.7% of
  injected works acquire a payment dated before their new sanction date against
  a 0.6% baseline. R-03 guards the rule side; this arrived from the generator
  side. **Open decision — fixing it changes every published held-out number.**
- **`Rule.__post_init__` checks a promise, not behaviour.** A rule that targets
  a held-out pattern without declaring it constructs fine. Proven: an
  undeclared `geo_in_district == 0` rule recovers `geographic_displacement` at
  recall **1.000** and raises nothing.
  `TestNoRuleSilentlyTargetsAHeldOutPattern` measures every rule against every
  held-out pattern and fails above 0.35 unless the pair is explained in
  `KNOWN_MECHANICAL`.
- **`pip install torch` is CPU-only on Windows.** Silent. Use the cu130 index.
- **A relative path in `.env` follows the cwd, not the repo.** `.resolve()`
  on `./data` meant running from `backend/` silently used `<repo>/backend/data`,
  created it empty and reported "no .xlsx in raw". Fixed by `config._anchor`;
  three tests pin it. Absolute values (what the containers pass) are untouched.
- **Python does not read `.env`; Docker Compose does.** `config.py` now loads it.
  Without that the container and native runs disagree on every credential.
- **pandas aligns rather than assigns** when you build a DataFrame with
  `index=work_id` from positionally-indexed Series. It shifted every geo feature
  one row and destroyed a 3.7° displacement signal while the contract still
  validated. Use `.to_numpy()`.
- **Winsorizing before anomaly detection clips the signal.** The extreme value
  *is* the finding.
- **An absolute tail threshold silently disables a layer, and this project has
  now been bitten by it twice.** L1 (Block 8) because `ecdf_tail` floors at
  `1/group_size`; L5 (Block 15) because the Kaplan-Meier curve bottoms out at
  0.199 and a gate at 0.02 was unreachable. The layer runs, emits valid output,
  and the signal is simply absent. **Gate on rank, always.**
- **`ecdf_tail` floors at `1/group_size`.** Any absolute tail threshold below
  that silently disables the layer for narrow peer groups. Gate on rank.
- **Similarity thresholds are backend-specific.** Sparse TF-IDF puts unrelated
  text near 0; dense embeddings near 0.45.
- **`min_df=2` on a tiny corpus** leaves only stopwords — two unrelated
  descriptions sharing "of" score cosine 1.0.
- **A weight is not an influence.** Under a weighted mean, `rules` held 43% of
  the nominal weight and 89% of the actual score mass, purely because it fires
  on 51.6% of the corpus against the others' 3%. Check share-of-mass, not the
  config.
- **Raw scores from different layers are not comparable**, so weighting them
  directly lets fire rate masquerade as strength. Calibrate to population tail
  probability first. Ranking within a layer's own hits does *not* work — it
  moved held-out PR-AUC by −0.003.
- **A mean cannot reward agreement.** Two layers firing ran at a 10.9% held-out
  rate against a 2.1% base, and averaging discarded it. Combine independent
  evidence multiplicatively.
- **Band cut-points are a policy on a scale.** Change the combiner and the
  scale moves under them; the bands widen and nothing says so. An acceptance
  check now guards the queue size.
- **Provenance predicts fire rate.** L0's `ASSUMED` thresholds fired on 36% and
  13% of the corpus; its `PEER_DERIVED` ones on 3.6% and 0.9%. An unverified
  constant is not just unsourced, it is usually *mis-set*.
- **Check a threshold against its own distribution before trusting it.** The
  75-day sanction window sat at the 64th percentile of the lag it measured. A
  rule cutting through the middle of its own data measures "typical".
- **Held-out PR-AUC will tell you to delete good targeted rules.** Per-rule
  leave-one-out said removing `unit_cost_above_peers` helps. It targets a
  rule-visible pattern at 89–100% precision. Same trap as L4 (ADR-0010).
- **A feature can be present, finite and carry no information.** L3's clustering
  ranged 0.415–0.443 and returned 1 community until the payee network was given
  locality. Check variance.
- **Numpy scalars are not JSON serialisable.** Use `util.to_jsonable`.
- **Git Bash mangles container paths.** Prefix `MSYS_NO_PATHCONV=1`.
- **`pytest ... | tail -N` throws away pytest's exit code.** A pipeline reports
  its *last* command's status, so `tail` returning 0 says nothing about whether
  the tests passed. Redirect to a file and check `$?`.
- **A test fixture that enumerates `GOLD_COLUMNS` breaks on every Seam A
  addition.** `make_work` did, and took twenty rules tests down twice in two
  blocks. Default unlisted columns to `NaN` -- rules abstain on missing inputs,
  so an unread column is inert and a newly-read one abstains rather than
  passing on a stray default.
- **Heredocs in the Bash tool choke on some Python.** Use the Write tool for
  source files.
- **A two-sided tail carries no direction, and reconstructing a percentile from
  one inverts half your evidence.** L1's evidence card derived
  `percentile = (1 - tail/2) * 100` from `ecdf_tail`, which is deliberately
  two-sided — a value in the bottom 1% and one in the top 1% both score 0.01,
  because for the ECOD contribution they *are* equally extreme. The result put
  every outlier near the 99th percentile: a stalled work at the **1.1st**
  percentile of reported progress was described to a reviewer as the **99.5th**,
  on the layer whose entire job is peer comparison. 597 findings in one run.
  Fixed by carrying `percentile_rank` through from `score_group` and rendering
  a `direction`. **A statistic that is symmetric by design cannot be asked which
  side it came from.**
- **Compose does not give a container the host's `.env`.** Only `./backend` and
  `./data` are mounted, so `config._load_dotenv()` finds nothing at `/app/.env`.
  `GEMINI_API_KEY` set in `.env` worked natively and did nothing at all under
  `drishti up` — the copilot reported "no key configured" while the file plainly
  had one. Variables must be forwarded explicitly in the `environment:` block
  (compose interpolates `${...}` from `.env` on the *host*). And a container
  must be **recreated**, not restarted, to pick up a changed environment.
- **A status code is not a diagnosis.** The copilot logged `Gemini returned 403`
  and told every caller to *set* `GEMINI_API_KEY`. A 403 on that API has three
  unrelated causes — API disabled for the project, key restricted to other APIs,
  referrer/IP restriction — and the advice was wrong for all of them, because
  the key was already set and already valid. Providers ship a machine-readable
  `reason` enum for exactly this; read it, and never read the `message` (an
  error body can echo the request, and the request carries guideline extracts).
  See `docs/COPILOT-GEMINI.md` §6.
- **A reason code says which call was refused, not why the obvious fix is
  unavailable.** `API_KEY_SERVICE_BLOCKED` reads as "the API is off for that
  project, go and enable it", and that reading was wrong. The Gemini API stopped
  accepting **standard** API keys in September 2026 and now takes only
  *authorization* keys — API keys bound to a Google Cloud service account. The
  Cloud console greys the *Gemini API* entry out of the key's restriction list
  with "This API requires authentication with a service account-bound API key",
  so the key could not have been repaired at all: it was the wrong **kind** of
  key. New keys from <https://aistudio.google.com/apikey> are authorization keys
  automatically. Note the org-policy trap behind it — binding a key to a service
  account is blocked by a default organization policy constraint, so on a
  Workspace or institutional account an admin may have to allow it first.

---

## 10. Uncommitted work — act on this first

**The repository has zero commits.** Roughly 120 files are staged; everything
above exists only in the working tree, on one machine, with no history.

```bash
git -C C:/dev/artha-drishti commit -m "Blocks 0-11: contracts, pipeline, L0/L1/L3/L4, evaluation"
```

Nothing has been committed on the user's behalf, and nothing should be
without them asking. But until it is, MLflow stamps `git_commit: unknown` on
every tracked run — so no experiment is reproducible, and a disk failure
loses the project.

**Separately:** `C:/Users/DELL` is itself a git repository with a public
remote (`github.com/Harshiee09/GenentAi.git`), zero commits, no `.gitignore`,
and the entire home directory untracked — `AppData/`, `.claude.json`,
`.docker/`, `NTUSER.DAT`. One `git add -A && git push` there would publish
credentials. It holds no history, so removing its `.git` loses nothing —
**but that is the user's call and they have not made it.**

---

## 11. Open questions the user has not answered

Carry these forward; do not silently decide them.

| # | question | why it matters |
|---|---|---|
| D-01 | Remove the stray git repo at `C:/Users/DELL`? | live credential-exposure path |
| D-05 | What does the modal **₹14.7 cr** limit represent — term-to-date, or something else? | every cost benchmark, and the deck's "₹5 cr/year", depend on it |
| D-07 | Local LLM or hosted API for the analyst copilot? | 8 GB VRAM is the constraint; an API key is a submission risk |
| D-08 | Source a real image corpus for L6, or design-only? | L6 has no input at all today |
| D-09 | Is there a real guidelines document to source rules from? | four of ten L0 rules stay assumptions until there is |

Resolved already: multilingual is **in scope** and implemented; the project
lives at `C:/dev/artha-drishti`, not under the home directory.

---

## 12. Honest limitations

State these plainly; do not let a demo imply otherwise.

- **Every performance figure is measured on data the project generated.** The
  held-out split and the independent corpus make some of it meaningful. None of
  it is a claim about real-world MPLADS detection.
- The one real dataset is 543 rows of Lok Sabha allocation limits. No works, no
  payments, no dates, no documents, no images.
- Districts are synthetic and flagged `is_synthetic`. MPLADS needs a nodal
  district; the source file has none.
- `geo_in_district` uses a bounding box, not point-in-polygon. `geo_method`
  records this.
- The payee edge is the payee on a work's *largest* payment, not the full
  payment graph.
- Four of ten L0 rules rest on project assumptions because
  `data/guidelines.md` does not exist yet.
- The submission deck claims "788 MPs" and "₹5 cr per MP per year"; the data
  covers 543 Lok Sabha members and a modal ₹14.7 cr term-to-date limit. Reconcile
  before presenting.
