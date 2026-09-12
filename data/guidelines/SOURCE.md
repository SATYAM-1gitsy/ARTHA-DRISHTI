# MPLADS Guidelines — primary source

Resolves open question **D-09** in part.

| | |
|---|---|
| Title | Guidelines on Members of Parliament Local Area Development Scheme (MPLADS) |
| Publisher | Ministry of Statistics and Programme Implementation, Government of India |
| **Edition** | **June 2016** |
| Retrieved | 2026-09-03 |
| URL | https://cdnbbsr.s3waas.gov.in/s3c3614206a443012045cfd75d2600af2d/uploads/2023/02/2023020891.pdf |
| Pages | 81 |

## Read the edition carefully

The file sits under a `/uploads/2023/` path on the government CDN and the
project previously cited "MPLADS Guidelines 2023" from memory. **The document
itself is the June 2016 edition.** A revised set of guidelines took effect on
1 April 2023 and is not this file.

Every constant sourced from here is therefore cited as *2016*, and anything the
2023 revision may have changed — the reported Rs 75 lakh trust/society ceiling
is the likeliest candidate — stays unverified until that edition is obtained.
Citing this as 2023 would put a false citation in front of an investigator,
which is the exact failure `domain.Sourced` exists to prevent.

## Clauses used

| clause | establishes | replaces |
|---|---|---|
| **Para 2.5** | SC 15% and ST 7.5% of the **annual entitlement** (Rs 75 lakh and Rs 37.5 lakh of Rs 5 crore) | unverified `SC_EARMARK_PCT` / `ST_EARMARK_PCT` |
| **Para 3.12** | recommended eligible works sanctioned **within 75 days** of receipt; rejection intimated within 45 days; model-code-of-conduct periods excluded | `SANCTION_WINDOW_DAYS`, previously `ASSUMED` |
| **Para 3.21.2** | Rs 50 lakh ceiling for assets built **by trusts and societies**, raised 50% to Rs 75 lakh in tribal areas (Para 2.5.1) | see below |

## What the document does NOT contain

**A general per-work ceiling.** The ceilings in the guidelines attach to
*recipient categories* — trusts and societies (Para 3.21.2) — and aided
educational institutions are explicitly subject to "no ceiling" (Para 3.37).
The Rs 25 lakh figure that appears in the document is Para 2.5.1's *additional
amount to be spent in tribal areas only*, which is a different quantity.

`PER_WORK_CEILING = Rs 25 lakh`, applied to every work, has no basis in this
document. It stays `ASSUMED` and `ceiling_breach` — which fires on 12.8% of the
corpus — is unresolved rather than verified.
