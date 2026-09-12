# ARTHA DRISHTI

AI-powered anomaly, fraud and compliance risk intelligence for the MPLAD Scheme.
Smart India Hackathon 2026 · Problem Statement **SIH26102** · MoSPI.

The system ingests MPLADS records — recommendations, sanctions, payments,
progress, assets — runs a layered detection engine over them, fuses the layers
into one explainable risk score per work, and serves prioritised, human-reviewable
alerts to four role-based dashboards.

> **It flags works for review. It never issues a verdict.**
> A rule violation is not an anomaly. An anomaly is not fraud. A model
> probability is not a legal conclusion. Every screen, endpoint and evidence
> card preserves those distinctions.

**Picking this up cold? Read [docs/HANDOFF.md](docs/HANDOFF.md) first** —
state, rules, measured numbers, and what to do next.

---

## Quick start

```bash
git clone <this repo> && cd artha-drishti
cp .env.example .env

pip install -r backend/requirements.txt
pip install -e .                  # `python -m drishti` needs this from the root
python -m drishti doctor          # check the machine
python -m drishti test            # run the suite
python -m drishti e2e             # the whole pipeline + acceptance gate

python -m drishti api             # terminal 1: API on :8000
cd frontend && npm install && npm run dev    # terminal 2: UI on :5173
```

Open <http://localhost:5173>. If the page says **Connected**, the whole stack is
wired: that value travelled browser → API → Python package.

Docker is optional — `python -m drishti up` brings the whole stack up, but
everything except the databases also runs natively, so a broken Docker install
never blocks anyone.

| Service | Port | What it is |
|---|---|---|
| `frontend` | 5173 | React + Vite dev server |
| `api` | 8000 | FastAPI. **No GPU** — it enqueues, it does not train |
| `ml-worker` | — | GPU-enabled Celery worker. CUDA lives here |
| `mlflow` | 5000 | Experiment tracking, backed by Postgres |
| `postgres` | 5432 | PostgreSQL 16 + PostGIS 3.4 |
| `redis` | 6379 | Celery broker and result backend |

The split between `api` and `ml-worker` is deliberate. The API image ships no
torch and requests no device, which keeps it small and its startup fast;
anything needing CUDA is enqueued onto the `gpu` queue and executed by the
worker. GPU jobs get their own queue because two concurrent training jobs will
not fit in 8 GB.

```bash
python -m drishti up -d
python -m drishti jobs gpu_probe      # proves CUDA works where training happens
python -m drishti jobs gpu_benchmark  # measures it
```

### GPU

The default `pip install torch` is a **CPU-only** build on Windows. It imports
fine and silently trains everything on CPU. Install it explicitly:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu130
python -m drishti gpu --require
```

The reference machine is an RTX 5070 Laptop GPU (Blackwell, `sm_120`, 8 GB).
`sm_120` kernels ship only in CUDA 12.8+ builds — a `cu121` or `cu124` wheel
installs happily and then fails at the first kernel launch.

---

## Commands

`make` is not available on the team's Windows machines, so the Makefile verbs
live in a Python task runner instead:

| Command | Does |
|---|---|
| `python -m drishti doctor` | check this machine can run the project |
| `python -m drishti gpu [--require] [--json]` | accelerator report |
| `python -m drishti test` | run the test suite |
| `python -m drishti api` | run the API without Docker |
| `python -m drishti worker` | run a Celery worker on this machine |
| `python -m drishti jobs gpu_probe` | enqueue a task and print its result |
| `python -m drishti up` | `docker compose up` |
| `python -m drishti ingest` | load the real allocation file (bronze -> silver) |
| `python -m drishti seed` | generate synthetic MPLADS data + ground truth |
| `python -m drishti features` | build the gold feature view |
| `python -m drishti score` | run detectors and fusion |
| `python -m drishti eval` | evaluate against ground truth, with ablation |
| `python -m drishti e2e` | ingest → seed → features → score, then the acceptance gate |
| `python -m drishti copilot [question]` | check the guidelines copilot, or ask it something |

Unimplemented verbs exit non-zero and name the block that builds them.

---

## Layout

```
artha-drishti/
├─ backend/drishti/
│  ├─ config.py     paths, seeds, fusion weights and combiner, band thresholds, GPU
│  ├─ domain.py     MPLADS constants — every one carrying its provenance
│  ├─ util.py       numeric substrate: robust stats, ECOD core, union-find, geo
│  ├─ textsim.py    multilingual normalization, lexical similarity, TF-IDF
│  ├─ gpu.py        accelerator detection and the CPU-build guard
│  ├─ cli.py        the task runner
│  ├─ api/          FastAPI application
│  └─ tests/        the suite
├─ frontend/        React + TypeScript + Vite
├─ data/
│  ├─ raw/          committed source data
│  ├─ seeds/  out/  api/     generated, git-ignored
│  └─ fixtures/     small committed samples that unblock parallel work
└─ docs/adr/        architecture decision records
```

## Design commitments

Four constraints are enforced in code rather than left to convention, because
each one is cheap now and expensive later:

- **Provenance on every constant.** `domain.Sourced` makes a benchmark state
  whether it came from a published document or is a project assumption, so the
  UI can never render an invented Schedule-of-Rates figure as if it were
  official. See `docs/adr/0001`.
- **Held-out fraud patterns.** The generator injects patterns no detector is
  written against. Only those figures may be quoted as detection performance;
  patterns a rule was written for measure agreement with the injector, not
  detection.
- **Evidence families, not layers.** Corroboration is counted across
  independent families — financial, temporal, network, textual, asset,
  compliance — so three layers firing on the same cost column count once.
- **Graceful fallbacks.** The detection core runs on numpy and pandas alone.
  Heavy libraries are accelerators, never requirements.

## Documentation

- `docs/adr/0001-baseline-audit.md` — repository, data, compute and model-readiness audit
- `docs/adr/0002-gpu-strategy.md` — what the GPU is for, and what it is not for
- `docs/adr/0003-contracts.md` — the five seams, and two changes to the manual's contract
- `docs/adr/0004-synthetic-generator.md` — the generator, and what its numbers mean
- `docs/adr/0005-feature-builder.md` — the Gold view, peer-relative features, and a silent bug
- `docs/adr/0006-l0-rules.md` — the rules engine, and three the Blueprint asked for that we did not write
- `docs/adr/0007-vertical-slice.md` — thin fusion, the acceptance gate, and a design bug it caught
- `docs/adr/0008-l1-unsupervised.md` — peer-relative anomaly detection, and two models that did not earn their place
- `docs/adr/0009-evaluation-harness.md` — the harness, and the first numbers that mean anything
- `docs/adr/0010-l4-duplicates.md` — multilingual duplicates, and a third category of evidence
- `docs/adr/0011-l3-graph.md` — network structure, and the ensemble losing to its best layer
- `docs/adr/0012-calibrated-fusion.md` — calibrated fusion, and fire rate masquerading as strength
- `docs/adr/0013-l0-selectivity.md` — L0 selectivity, and a threshold that cut its own median
- `docs/adr/0014-l5-temporal.md` — L5 temporal, a layer that did not earn its place
- `docs/adr/0015-review-and-repair.md` — a review block: the pipeline could not run, and one line cost two thirds of a layer
- `docs/adr/0016-product-surface.md` — closing the Blueprint gap, and the one rule measurement would not let us write
- `docs/adr/0017-injector-artifact-and-real-guidelines.md` — the generator was inflating the headline, and D-09 is partly answered
- `docs/COPILOT-GEMINI.md` — wiring the Gemini free tier into the analyst copilot, and reading the failure when it does not work
