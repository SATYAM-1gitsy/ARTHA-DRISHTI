# ADR 0001 — Baseline audit and the constraints it imposes

- **Status:** accepted
- **Date:** 2026-08-29
- **Supersedes:** `implementation_plan_MLA.md` (an earlier plan proposing Streamlit,
  SQLite, autoencoders and Benford's Law as headline methods)

## Context

Block 0 inspected the supplied material and the machine before any code was
written. Two premises in the project brief did not hold, and correcting them
changes what gets built first.

**There was no repository.** The project directory held one file — an XLSX of
MP allocation limits. The Build Manual's §1.3 layout, its §12.4 fallback
substrate and the five modules Appendix B describes as "already scaffolded in
this repo" (`config.py`, `domain.py`, `util.py`, `textsim.py`, `schema.py`) did
not exist anywhere on disk. The team's entire resilience story was unwritten
code.

**The data is thinner than the design assumes.** The XLSX holds 543 rows —
exactly the Lok Sabha strength, with no Rajya Sabha or nominated members —
across five columns. 389 of 542 non-null amounts (71.8%) are the identical
value ₹14.7 crore. There are no works, sanctions, payments, dates, agencies,
vendors, descriptions, coordinates, documents or images. Every detector in the
design operates at `work_id` granularity, and there is not one work in the file.

The file is not useless: its state distribution matches real Lok Sabha seat
counts, its constituency names are real, and 126 carry `(SC)`/`(ST)` reservation
markers. That is enough to anchor a synthetic generator to real geography
instead of inventing it.

## Decisions

### 1. Locate the repository outside the home directory

`git rev-parse --show-toplevel` from the original project folder returned
`C:/Users/DELL` — a repository with zero commits, zero tracked files, no
`.gitignore`, and an `origin` pointing at a public GitHub repo. Everything under
the home directory was therefore in scope for an accidental `git add -A`,
including `AppData/`, `.claude.json` and `.docker/`.

Building at `C:\dev\artha-drishti` puts the project beyond that repository's
reach without deleting anything. **Still outstanding:** that stray repository
remains a live exposure path for other work in the home directory. It holds no
commits and no tracked files, so removing it loses nothing.

### 2. Provenance is a field, not a comment

The most quotable line in the design is *"unit cost 2.4× the Schedule of Rates
benchmark"*. No Schedule of Rates has been digitised, so that benchmark would be
a number somebody invented — and it is the first line a domain judge probes.

`domain.Sourced` carries `value`, `provenance` and `citation` together.
Provenance is one of `GUIDELINE_CLAUSE`, `CAG_FINDING`, `PEER_DERIVED` or
`ASSUMED`. Every SoR entry is currently `ASSUMED`, and a test enforces that they
cannot silently claim otherwise. Cost evidence must lead with the peer-derived
percentile, which is computed from data and defensible; the SoR ratio is
secondary and labelled.

The same applies to rules: `data/guidelines.md` — the condensed MPLADS
Guidelines 2023 — does not exist, so every compliance rule citing it currently
cites a document nobody has read.

### 3. Fraud patterns split into rule-visible and held-out

If the generator injects `pre_sanction_payment`, L0 has a
`pre_sanction_payment` rule, and evaluation reports recall on
`pre_sanction_payment`, the result is ≈1.0 by construction. It measures whether
the rule and the injector agree — not whether anything was detected.

`domain.PatternVisibility` splits the registry. `HELD_OUT` patterns are injected
but no detector may be written against them. Only held-out figures may be quoted
as detection performance. Tests enforce that both sets are non-empty, disjoint,
and that the held-out set spans at least three evidence families.

This is also why a supervised model trained on synthetic labels is a controlled
benchmark and not a performance claim: it recovers the generator's injection
logic.

### 4. Corroboration is counted across evidence families

A plain weighted sum over layer scores double-counts: L0's ceiling rule, L1's
peer cost outlier and L2's top SHAP feature are three views of one `unit_cost`
signal, not three independent confirmations.

Every `FraudPattern` declares an `evidence_family` — financial, temporal,
network, textual, asset or compliance. Fusion counts corroboration across
families. The Block 1 `FusionConfig` still uses a weighted sum as a placeholder
so the pipeline stays runnable; Block 13 replaces the arithmetic while keeping
the configuration surface.

### 5. A Python task runner replaces `make`

`make` is not installed and the team is on Windows, so `make e2e` — the
manual's daily integration heartbeat and its definition of a green `main` —
could never have run for anyone. `python -m drishti <verb>` exposes the same
verbs. Stages that do not exist yet exit 2 and name their block; a stub that
silently succeeds is worse than one that refuses.

## Consequences

- L6 vision and document intelligence have **no input at all** — no images, no
  UCs, no bills. They can be designed, not built. Photo checks are limited to
  pHash and EXIF over synthesized metadata.
- The synthetic generator is the load-bearing dependency of the whole system,
  not one workstream among six. Its quality caps everything measured downstream.
- Two claims in the submission deck need reconciling before the pitch: "788 MPs
  monitored — Lok Sabha + Rajya Sabha" (the data covers 543 LS members) and
  "₹5 cr allocated per MP, every year" (the file's modal figure is ₹14.7 cr,
  apparently a cumulative term-to-date limit).

## Data defects carried forward

| ID | Defect | Handling |
|---|---|---|
| D-01 | Row 109 (Nanded, Maharashtra) has a null allocation | Quarantine at ingest; report, do not impute |
| D-02 | NANDED appears twice — consistent with the 2024 by-election | MP term validity dates; constituency is not a primary key |
| D-03 | 82 `(SC)` and 44 `(ST)` markers against 84/47 reserved seats | Five seats' status is unrecoverable from the name; join externally or mark `unknown` |
| D-04 | 311 names ALL-CAPS, 232 mixed case | Entity resolution in Block 3 |
| D-05 | Amount semantics undefined | Blocks any utilisation percentage until confirmed |
