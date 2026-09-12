# ADR 0016 — Closing the Blueprint gap, and the one rule measurement would not let us write

- **Status:** accepted
- **Date:** 2026-09-02

## Context

ADR-0015's conformance review found the split: the detection core met or
exceeded the Blueprint's §4–§6 standard, and the product surface around it —
§10 analytics, three of §11's four dashboards, §12's RBAC and audit — was
largely unbuilt. Three of the Blueprint's seven stated differentiators (§16)
were therefore unavailable.

This block builds the surface. It does not touch the detection engine, and no
number the engine reports has moved.

## What landed

| Blueprint | Before | Now |
|---|---|---|
| §10 endpoints | 7 of 16 | **15 of 16** |
| §11 dashboards | 1 of 4 | **4 of 4** |
| §12 RBAC + jurisdiction scoping | none | role + scope on every endpoint |
| §12 immutable audit log | table, no writer | append-only, every decision and refusal |
| §16.5 human-in-the-loop | none | full review workflow with weak-label capture |
| §4.3 / §18.2 SC/ST earmark | absent | aggregate compliance report |

The one endpoint still absent is the GenAI copilot (§10, §16.6). It is blocked
on open question D-09: RAG over a Guidelines document is not possible while
`data/guidelines.md` does not exist.

## Decision 1 — the alert id is the work id

The queue derived `alert_id` from a row's **position**, which changes under
pagination and again on every re-score. A review recorded against alert 42
would later describe a different work. One flagged work is one alert, so the
work id is the id — stable across re-scores, and a lookup rather than a join.

## Decision 2 — a review is an event, not a field

`alert_review` is append-only and current status is derived by replaying it.
"opened → under_review → dismissed → reopened" is precisely the sequence an
audit needs, and a status column keeps only the last step of it. Appends also
never conflict, which makes concurrent writers correct without a lock protocol.

Backed by JSONL rather than Postgres, because the project runs natively by
design and a review workflow that requires `docker compose up` is one nobody
uses while developing. The columns mirror the DDL one-for-one, so moving to
Postgres is a change of backend inside one module.

**A reviewer's outcome stays a weak label.** `contracts.labels` already says a
human review and a synthetic injection are different kinds of evidence; a
dismissal may be correct or may be a missed case. The panel says so at the
moment of deciding rather than in documentation nobody reads then.

## Decision 3 — scope the data, do not guard the door

`Principal.scope` is applied inside `Store.joined()`, so every endpoint is
scoped by construction rather than on the ones somebody remembered to guard. A
district officer opening the national view gets **their district's** numbers,
not a 403 arriving after the country has already been aggregated — which is
also what lets one set of components serve all four roles.

Two asymmetries are deliberate:

* **Reading out of scope is a 404, not a 403.** Telling a caller that a work
  exists and is merely forbidden leaks its existence. To a district officer, a
  work in another district is simply not there.
* **Writing out of scope is a 403, and is audited.** A refused action by an
  out-of-jurisdiction reviewer is exactly the event an audit wants to see.

An MP cannot action an alert at all. The scheme separates recommending a work
from sanctioning and reviewing it, and the product must not collapse that.

Header-based and **not a security boundary** — anyone can set a header. It is
shaped like a JWT decoder so replacing it is one function, `require_write`
already refuses the anonymous default, and both the API and the UI footer say
so rather than implying an authentication that does not happen.

## Decision 4 — the earmark check is an aggregate, because measurement said so

Blueprint §18.2 asks for an "SC <15% / ST <7.5% earmark shortfall" rule and
§6.1 adds "checked at MP/entitlement aggregate level, not per-work". Measured
before writing anything, as a per-work predicate it fires on:

> **87.1% of the corpus** — 17,321 flags carrying 475 distinct findings

because every one of a member's works inherits their portfolio's shortfall.
That buries the queue and trips the acceptance gate's queue-size check. It is
the same failure ADR-0013 already paid for with the 75-day sanction window.

So it is a portfolio report, not an L0 rule, and a test asserts no rule code
contains "earmark". Two caveats ship **inside the payload**, because this is
the figure most likely to be quoted at a member:

* the share is of sanctioned cost **recorded here**, not of the annual
  entitlement the Guidelines actually earmark; and
* the area flags are generator-assigned and the generator does not model
  earmark compliance at all, so the 87% describes synthetic data and says
  nothing about real members.

## Decision 5 — ranked tables need a denominator

"Worst agencies" was initially every agency holding a single flagged work, all
at 100%: arithmetically correct, useless as a list of who to look at. Ranked
tables now require ten works; full tables stay complete, because there the
reader is scanning a population rather than a top ten.

## A dtype bug the engine switch exposed

`exif_consistent` is declared `int8` and nullable, so it is held as pandas
`Int8`. Written by fastparquet and read back by pyarrow, its nulls return as
`float64` — values intact, dtype not, which is enough to fail the fixture
schema-identity check.

Both engines are self-consistent; the mismatch appears only when the writer is
not the reader, which is what happens when one machine's pyarrow is blocked and
another's is not. This project has now been on both sides of that in one
session — **pyarrow's `_parquet` module began importing again partway through**,
after ADR-0015 documented it as blocked.

`storage.read_gold()` restores the declared dtypes from the Seam A contract, so
the Gold view presents one schema wherever it is read, under either engine.
Four read sites go through it.

## Declined, again

The Blueprint's §18.2 `geo_outside_district` rule, its year-end rule and its
duplicate-photo rule each target a **held-out** pattern.
`Rule.__post_init__` raises on them by construction, and writing them would
convert the project's only quotable recall figure into a tautology. They stay
declined. Aligning with the Blueprint means building what it asks for where
that is sound, not building the three things it asks for that would destroy the
measurement it also asks for.

## Consequences

- 846 tests, 836 passing, 10 skipped; the eleven-check gate stays green.
- No detection number moved: `drishti score` reproduces identical band counts.
- The review log is the first thing in this project that is **not** derivable
  from a re-run. `data/out/alert_reviews.jsonl` is real state, and a future L2
  training split will read it as `LabelSource.HUMAN_REVIEW`.
- Still open: the copilot (blocked on D-09), maps and choropleths, drift
  monitoring, and L2 itself.
