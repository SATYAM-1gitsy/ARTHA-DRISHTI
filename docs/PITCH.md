# ARTHA DRISHTI — pitch script (detailed)

Smart India Hackathon 2026 · SIH26102 · MoSPI

**Runtime ~11:30**, six speakers, eleven beats. Technical throughout — but every
term is landed with a plain-English gloss in the same breath, because a judge
who loses the thread stops listening.

**Marked `[CUT]` paragraphs can be dropped to land at 8:00** without breaking
any handoff.

> **Two scripts, one set of numbers.**
> This is the **detailed** version — eleven beats, considerably more technical,
> and written so every speaker explicitly picks up and hands on what the one
> before them produced. The **short, soft-English** version is
> [`docs/PITCH-SHORT.md`](PITCH-SHORT.md): ~8:00, nine beats, minimal jargon.
>
> Pick one and rehearse it. Do **not** mix beats between them — this version's
> handoffs only work in sequence. The §Numbers section is identical in both and
> is binding in both; if `drishti eval` moves a figure, fix **both** files.

> **Why this file lives in the repo.** The script quotes measured numbers. When
> `drishti eval` moves them, this file has to move too — keeping it beside
> `docs/HANDOFF.md` is what stops a stale figure being read aloud to judges.
> Verified **2026-09-04**. Re-check §Numbers before you present.

---

## The weave

This is not six people describing six modules. Each speaker picks up a named
thing the previous one produced and hands a named thing to the next. The chain
is the architecture, and saying it out loud is what makes six components sound
like one system.

| # | Speaker | Picks up | Hands on |
|---|---|---|---|
| 1 | **Harsh** | — | the three distinctions the whole system defends |
| 2 | **Tanish** | those distinctions | **the Gold view** — 68 columns, one row per work |
| 3 | **Harsh** | the Gold view | **layer outputs** from L0 rules and L1 anomaly detection |
| 4 | **Satyam** | the same Gold view | layer outputs from L4 duplicates and L3 network — and the *textual* evidence family |
| 5 | **Harsh** | all four layers' outputs | **four separate quantities** per work |
| 6 | **Satyam** | those quantities | the held-out proof they generalise |
| 7 | **Lakshay** | the scored population | a **scoped, audited API** |
| 8 | **Japleen** | the API | the **ranked queue** |
| 9 | **Ananya** | a selected work | the **evidence card** |
| 10 | **Tanish** | the evaluation | the admission that his generator was cheating |
| 11 | **Harsh** | all of it | the close |

**Cast**

| Speaker | Owns |
|---|---|
| **Harsh** — ML | Rules engine (L0), peer-relative anomaly detection (L1), fusion, evaluation |
| **Tanish** — Data | Ingestion, synthetic generator, schema, Gold feature view |
| **Satyam** — ML | Multilingual duplicates (L4), network analytics (L3) |
| **Lakshay** — Backend | FastAPI, alerts, RBAC, copilot, Celery/Redis |
| **Japleen** — Frontend | Dashboards, review queue |
| **Ananya** — Frontend | Evidence card, copilot panel |

---

## 1 · 0:00 — 1:00 · Harsh · The three distinctions

> Good morning. We're team ARTHA DRISHTI, and we've built an anomaly and
> compliance monitoring system for the MPLAD Scheme.
>
> Under MPLADS, every Member of Parliament recommends local development works —
> a school toilet, a village road, a solar unit. **788 Members**, every district
> in India, every year. Somebody has to verify that the money did what it was
> meant to do, and today that verification is largely manual against a volume
> that makes manual impossible.
>
> The obvious build is: throw a classifier at it and have it output "fraud" or
> "not fraud". We deliberately did not build that, and the reason shaped every
> architectural decision that follows — so I want to put it first.
>
> There are three distinctions, and they are not the same distinction.
> **A rule being violated is not an anomaly.** A payment can breach a guideline
> for a dull administrative reason. **An anomaly is not fraud.** A statistical
> outlier is unusual, and unusual is not wrong. **And a model probability is not
> a legal conclusion.** A score of 0.9 is not evidence of anything.
>
> Collapse those three and the first person you damage is an honest officer with
> an untidy file. So we enforce them in code rather than in a slide.
>
> **The system flags works for review. It never issues a verdict.**
>
> Everything the next five people describe is downstream of that one sentence.
> Tanish — where does the data come from.

---

## 2 · 1:00 — 2:20 · Tanish · The medallion, and a sealed split

> Harsh said those distinctions are enforced in code. The first place that
> happens is mine, because you cannot protect a distinction in a model if you
> have already destroyed it in the schema.
>
> We use a **medallion architecture** — three layers, Bronze, Silver, Gold.
>
> **Bronze** is the raw ingest, unchanged and unjudged. Our one real dataset is
> the official allocation limits for **543 Lok Sabha members across 36 states
> and union territories**. We read it, we validate it, and anything that fails
> validation goes to a quarantine table rather than being quietly dropped.
>
> **Silver** is canonicalisation — resolving the same Member written five ways
> into one entity, and recording every repair we made, so a correction is
> auditable rather than invisible.
>
> **Gold** is the one that matters to everyone after me. It is a single feature
> view: **one row per work, sixty-eight columns**, and it is a *frozen contract*.
> Every detector in this system reads the Gold view and nothing else. No
> detector reads another detector's output. That is what lets Harsh and Satyam
> work in parallel without colliding, and it's why adding a new detector is
> additive rather than a rewrite.
>
> `[CUT]` One rule inside it: **missing is null, never zero.** A work with no
> coordinates gets `geo_in_district = null`, not `0`. The difference between
> "outside the district" and "we don't know" is the difference between an alert
> and a question, and zero-filling erases it.
>
> Now — the honest part. There is no public dataset of MPLADS works, payments
> and site photographs. So we generate one: about **twenty thousand works**,
> anchored to that real allocation spine so the money and geography stay
> plausible.
>
> And we inject **thirteen known fraud patterns**, split into two groups.
>
> Eight are **rule-visible** — the detection team knows them and may write
> detectors for them. Five are **held out**: vendor round-tripping, year-end
> bunching, geographic displacement, progress reversal, photo reuse. Nobody on
> the detection side may write anything aimed at those five. It is not a
> convention — the code raises an exception if a rule declares a held-out
> target, and a test measures every rule against every held-out pattern and
> fails the build if any rule recovers one it never declared.
>
> That sealed split is the only reason any number we quote today means
> anything. Harsh — you've got sixty-eight columns. What do you do with them.

---

## 3 · 2:20 — 3:40 · Harsh · Deterministic first, then peer-relative

> Two detectors, and they are deliberately different *in kind*, so that when
> they agree the agreement carries information.

### L0 — the rules engine

> The first is deterministic. No model, no probability, no training. It checks
> facts about the record. Was a payment dated *before* the sanction that
> authorised it? That isn't suspicious — it's impossible, and it needs an
> explanation.
>
> Rules are **data, not code**: each one is a value carrying its predicate, its
> severity, the columns it needs, and its **provenance**. Provenance is the part
> I'd defend hardest. Every threshold declares whether it came from a published
> guideline clause, a CAG audit finding, the data itself, or a **project
> assumption** — and Ananya renders that distinction on screen, so an assumption
> can never borrow the authority of a real clause.
>
> And a rule **abstains** rather than guessing. If the columns it needs are null
> in Tanish's Gold view, it does not fire *and* it does not count as evidence of
> compliance. That abstention lowers the work's confidence, which is why
> confidence has to be carried separately from score.
>
> `[CUT]` We measured something uncomfortable there: our assumed thresholds
> fired on 36% and 13% of the corpus, while our peer-derived ones fired on 3.6%
> and 0.9%. An unverified constant isn't just unsourced — it's usually mis-set.

### L1 — peer-relative anomaly detection

> The second needs no labels at all, and one modelling choice dominates it:
> **a work is scored against its peers, not against the population.**
>
> Score globally and you don't find outliers, you find sectors. An expensive
> metro flyover and an expensive rural culvert are both expensive; only one is
> anomalous. So each work is assigned the narrowest **peer group** that is
> statistically large enough — sector, work type and state, widening only if
> that group is too small to have a distribution.
>
> Inside the group we run two estimators. **ECOD** — empirical cumulative
> distribution outlier detection — asks, per feature, how little of the sample
> lies further out than this value, and sums the surprisal across features. It's
> parameter-free, and its per-feature contributions read directly as evidence.
> Alongside it a **median-absolute-deviation z-score**, which catches a single
> extreme value that ECOD dilutes across twenty columns.
>
> `[CUT]` Two things we deliberately do *not* do. We don't winsorize —
> clipping the top one per cent is standard practice and exactly wrong in an
> anomaly detector, because the extreme value *is* the finding. And we gate on
> **rank within the peer group**, never on an absolute tail probability, because
> an empirical tail floors at one over the group size — an absolute threshold
> below that silently disables the layer for narrow groups while appearing to
> work on wide ones.
>
> Both detectors emit the same shape: **one row per work, including the silent
> ones**, carrying a score, a confidence, and human-readable reasons. Satyam's
> two layers emit that identical shape — which is what makes fusion possible at
> all. Satyam.

---

## 4 · 3:40 — 5:10 · Satyam · Relationships, not numbers

> Same sixty-eight columns Tanish described, same output contract Harsh just
> described. My two detectors look at *relationships* rather than magnitudes.

### L4 — multilingual duplicate detection

> A real failure mode in schemes like this is one work funded twice under two
> descriptions. In India that's harder, because the descriptions arrive in
> different languages and scripts — "Construction of school toilet at Ward 21"
> and the same sentence in Devanagari are the same work.
>
> Comparing twenty thousand descriptions pairwise is two hundred million
> comparisons, so we **block** first — group candidates by district and work
> type, so we only score pairs that could plausibly be duplicates. Then a
> **multilingual bi-encoder** embeds each description into a vector space where
> distance is *meaning*, not spelling, and we take cosine similarity. Confirmed
> pairs get merged into clusters with **union-find**, so three works that are
> pairwise similar become one cluster rather than three separate alerts.
>
> The number: on **thirty-six pairs we wrote and hand-labelled ourselves** —
> data the generator never touched — the semantic approach scores **0.94
> ROC-AUC** against **0.49** for lexical token matching. Word-matching across
> scripts is a coin flip. This isn't.
>
> And here is why that matters more than it looks. Harsh's fusion counts
> corroboration across six **evidence families** — financial, temporal, network,
> textual, asset, compliance. **L4 is the only detector in the entire system
> that can produce a textual observation.** Turn it off and that family doesn't
> get weaker, it ceases to exist, and no amount of the other layers substitutes
> for it.

### L3 — network analytics

> The second is structural. A work isn't a row; it sits in a graph of the Member
> who recommended it, the executing agency, and the vendor who was paid.
>
> We compute generic properties of that graph in numpy — no NetworkX, because
> the detection core has to run on numpy and pandas alone. **Herfindahl–Hirschman
> index** for how concentrated an agency's vendors are. **Local clustering
> coefficient** for how closed a vendor's neighbourhood is. **Label propagation**
> for community structure.
>
> `[CUT]` Counting triangles means the diagonal of the adjacency matrix cubed.
> Written as a naive `einsum` that cost 29.5 seconds on a 2,279-node graph;
> written as `sum(A * (A @ A))` it reaches BLAS and costs 0.13. Same maths, 230
> times faster, and two thirds of the layer's runtime.
>
> Now — note what I did **not** build. Vendor round-tripping is one of Tanish's
> five sealed patterns. So there is no ring detector here. Only general
> structure. Which sets up the number Harsh and I come back to shortly.
>
> Harsh — you've got four layers all emitting the same contract. Combine them.

---

## 5 · 5:10 — 6:20 · Harsh · Fusion, and why a mean fails

> Four layers, same shape, and the naive move is a weighted average. We shipped
> that first and then measured it, and it was wrong twice over.
>
> **First: a weight is not an influence.** Our rules layer held 30% of the
> nominal weight and **75% of the actual score mass**, purely because it fires
> on a quarter of the corpus while the others fire on three per cent. Raw scores
> from different detectors aren't on a common scale, so weighting them directly
> lets *fire rate* masquerade as strength.
>
> **Second, and worse: a mean cannot reward agreement** — and agreement is the
> strongest signal in the data. Works where no weighted layer fires sit at a
> 1.4% problem rate. One layer, 3.2%. **Two independent layers agreeing, 7.5%
> — more than five times the base rate.** Averaging two moderate signals gives
> something *lower* than one loud signal, so the arithmetic was actively
> discarding the best evidence in the system.
>
> So we replaced it with **calibrated noisy-OR**. Two pieces, and they only work
> together.
>
> **Calibrate**: replace each raw score with how *rare* it is — the upper tail
> probability of that score across the whole scored population. Now a weight
> means the same thing for every layer, and firing at all on a rare detector is
> itself evidence.
>
> **Noisy-OR**: combine as independent evidence — one minus the product of those
> tail probabilities, each raised to its weight. Agreement compounds, and no
> single layer can saturate the ranking.
>
> `[CUT]` The calibration reads **score distributions only — never labels**.
> It cannot leak ground truth into the ranking, which matters because the whole
> evaluation rests on that.
>
> And what comes out is not one number. It's **four, kept deliberately separate**:
> **overall risk** — how concerning; **confidence** — how well-evidenced, computed
> from independent *families*, not layer count, so three layers firing on the
> same cost column count once; **severity** — consequence if true; and **data
> quality** — how complete the inputs were.
>
> Collapse those four into one and a thin lead and a corroborated case become
> indistinguishable. Japleen will show you why that's a product decision, not a
> modelling one.
>
> Satyam — do these numbers survive contact with data we've never seen?

---

## 6 · 6:20 — 7:20 · Satyam · The proof

> Two questions, and they're different. Does it detect anything it wasn't told
> about — and is that a property of the system or of one lucky dataset.
>
> **First.** On **vendor round-tripping** — one of the five sealed patterns,
> which I was explicitly forbidden from writing a detector against — the system
> recovers **92.8%** of injected cases. That's genuine generalisation: a general
> measure of network shape catching a specific pattern it was never shown.
>
> Now the honest framing, because we won't do the other thing. Across all five
> sealed patterns together we're at about **twice the base rate**. Better than
> chance. Nowhere near solved. Some of the five we catch well; progress reversal
> we barely catch at all. We know which is which and it's documented.
>
> `[CUT]` And note what we *don't* quote. On the eight rule-visible patterns our
> numbers look far better — but that measures a rule agreeing with the injector
> that created the pattern. It's a pipeline correctness check, not a detection
> claim, and our evaluation code physically refuses to pool the two. Asking it
> for a combined headline raises an exception with an explanation.
>
> **Second question — is it just this dataset?** We regenerated everything twice
> with different random seeds and re-ran the entire pipeline on data it had
> never scored.
>
> **Every number held.** Held-out performance within noise on all three. Every
> layer kept the same marginal contribution, the same ordering, the same sign —
> our graph layer at plus 0.0147, 0.0147 and 0.0148 across three independent
> samples. Nothing in this system is fitted to the sample we developed on.
>
> Lakshay — how does a district officer actually get at this.

---

## 7 · 7:20 — 8:40 · Lakshay · Scoped, audited, and offline-capable

> Harsh's four quantities land in my layer, and three things happen to them.
>
> **Jurisdiction scoping.** Four roles that must not see the same data. The
> Ministry sees the country; a state nodal officer their state; a district
> officer their district; a Member their own portfolio, read-only.
>
> The subtlety is that scoping a query is not the same as refusing one. A
> district officer opening the national dashboard gets *their district's*
> numbers, not a 403. And a work outside their jurisdiction returns **404, not
> 403** — deliberately. Telling someone a record exists and is merely forbidden
> leaks the existence of the record. To that officer, it simply isn't there.
>
> **An append-only audit trail.** When a reviewer moves an alert, we never
> overwrite the previous state — we append. Opened, under review, dismissed,
> reopened, each with actor and timestamp. For an accountability tool the
> *sequence* is the record, and collapsing it to a current status destroys the
> only evidence of who decided what.
>
> `[CUT]` One bug worth admitting: alert IDs were originally the row's position
> in the queue, so a recorded review would later describe a *different* work
> after a re-score. They're keyed on the work ID now — a queue position is not
> an identifier.
>
> **And the guidelines copilot.** An officer asks in plain language — "what
> share of works must be in Scheduled Caste areas?" — and gets the answer with
> paragraph number and page, from the real June 2016 MPLADS guidelines. We chunk
> that document on **clause boundaries rather than fixed width**, because a
> chunk split mid-clause can't cite anything truthfully. A hundred and
> twenty-five citable clauses, retrieved with TF-IDF cosine locally.
>
> The design decision I'd defend anywhere: **the language model is never asked
> what the guidelines say.** Retrieval runs first and locally; the model is
> handed the clauses we already found and permitted only to phrase them. A
> copilot that invents a guideline is worse than no copilot, because an invented
> clause arrives wearing exactly the authority of a real one.
>
> Which also means it needs no internet and no API key. Without one it hands you
> the clauses verbatim. **Nothing you see on stage today depends on a live
> external service.**
>
> Japleen — what does this look like at 9am on a Monday.

---

## 8 · 8:40 — 9:35 · Japleen · The queue

> Everything so far produces one thing: an ordered list short enough to work
> through.
>
> This is the district view. Not twenty thousand rows. Thirteen.
>
> And it's ordered on the tuple Harsh described — **risk first, then confidence
> as the tiebreak** — so a thinly-evidenced work never outranks a corroborated
> one at the same score. That sounds like a detail. It moved our measured recall
> by a full percentage point, because our rules layer emits a handful of
> discrete scores and thousands of works tie exactly; confidence is what orders
> them inside the tie.
>
> Two deliberate choices on this screen.
>
> **We render risk and confidence as two separate bars and refuse to merge
> them.** High risk, thin evidence is a *lead* — make a phone call. High risk,
> four independent evidence families is a *case* — send an inspector. One number
> makes those identical and an officer would treat them identically.
>
> **And that counter reports how much of the queue is thinly evidenced.** We put
> our own weakest result on the front page permanently. An officer is entitled
> to know how soft their queue is before they spend a week on it.
>
> `[CUT]` The same components serve all four roles — switching role changes the
> request headers and the API re-scopes underneath. One codebase, four
> dashboards, no forked UI.
>
> Ananya — someone clicks a row.

---

## 9 · 9:35 — 10:30 · Ananya · The evidence card

> And this is the actual product. Not the score — this.
>
> It answers *why*, in sentences built from the reasons Harsh's and Satyam's
> detectors emitted. "The unit cost is 2.4 times the median of 340 comparable
> works, in the highest 1.8% of that group." A comparison with its denominator,
> not a number — so a reader can judge whether it means anything.
>
> `[CUT]` The direction matters and we got it wrong once. A two-sided tail
> statistic can't tell you which side you're on, and a work in the *bottom* one
> per cent of reported progress was being described as the ninety-ninth
> percentile — the exact inverse of the finding, on nearly six hundred cards.
> Caught it, fixed it, and the reason text now names the side explicitly.
>
> Beside every finding is **where its threshold came from** — the provenance
> Harsh described, rendered. Guideline clause, CAG finding, peer-derived, or
> **"project assumption — not verified"** in plain sight. We could have hidden
> that. It would have looked more confident, and it would have been precisely
> the failure this system exists to prevent.
>
> Then the timeline. Then **what's missing** from the record, because a gap
> changes what a finding means — that's the fourth quantity, data quality, made
> visible.
>
> And it ends with **what to actually check**: request the utilisation
> certificate, verify the measurement book, inspect the site. A verifiable next
> action, not a conclusion.
>
> Every card carries the same line: *flagged for review based on statistical and
> rule-based signals; this is not a finding of wrongdoing.*
>
> Tanish — there's one thing we haven't told them.

---

## 10 · 10:30 — 11:00 · Tanish · What my generator was doing

> There is, and it's mine.
>
> Late in the build our headline detection figure was about **three and a half
> times better** than what Satyam quoted you. We were pleased with it.
>
> Then I audited my own injector. One of the five sealed patterns — year-end
> bunching — works by moving a sanction date forward into March. My code moved
> the sanction date and left the recommendation date and the payments where they
> were.
>
> That manufactured **two unrelated violations as a side effect**: an inflated
> sanction lag, and payments that now appeared to predate their own sanction.
> And two of Harsh's rules — rules that target nothing, that were never written
> against this pattern — were quietly recovering it off those artefacts at 0.86
> and 0.74.
>
> Recall on that pattern was 83%. With the timeline moved as a whole, it is 28%.
>
> **The system was never detecting year-end bunching. It was detecting me.**
>
> Nobody outside this room would have known. Harsh.

---

## 11 · 11:00 — 11:30 · Harsh · Close

> We fixed the generator, and our best number fell by two thirds — to the ones
> you heard today.
>
> That's the most important thing in this pitch, and it isn't a feature. A tool
> that touches public money and an official's reputation is only worth having if
> it tells you the truth when the truth is inconvenient. So we built the
> discipline into the code rather than the culture: **888 automated tests**, an
> **eleven-point acceptance gate** the pipeline must clear before it publishes
> anything, and an evaluation harness that **refuses** to produce the flattering
> combined number.
>
> `[CUT]` And we know exactly what's next, because we measured it: our
> strongest single layer currently outperforms the full ensemble at the head of
> the queue. We know why, we know it reproduces on unseen data, and we know that
> the honest fix is a design decision rather than tuning a weight against the
> only metric we trust.
>
> So this isn't a fraud detector. It's a way to make oversight **possible** at
> the scale MPLADS actually runs at — a short, ordered, evidence-backed queue,
> where a human being still makes every decision, and every decision leaves a
> record.
>
> **It flags works for review. It never issues a verdict.**
>
> Thank you.

---

## Numbers — what you may and may not say

**Verified 2026-09-04.** Re-run `python -m drishti eval` before presenting. If
anything below has moved, fix this file *before* the rehearsal.

### Safe to quote

| Figure | Value | Why it's safe |
|---|---|---|
| Vendor round-tripping recall | **92.8%** | Held-out — no detector was written against it |
| Duplicates vs lexical baseline | **0.94 vs 0.49** ROC-AUC | 36 hand-labelled pairs the generator never produced |
| Overall held-out performance | **~1.9× base rate** | Honest and unflattering. Say it as "better than chance, not solved" |
| Stability | Same values on **3 seeds** | Two datasets never scored before |
| Corroboration | **7.5% at two layers** vs 2.1% base | Measured |
| Score mass concentration | rules = **75%** of mass on 27% fire rate | Measured; motivates calibrated noisy-OR |
| Scale | 19,875 works · 543 real MPs · 36 states · 68 columns · 125 clauses | Counts, not performance |
| Discipline | 888 tests · 11-check gate | Counts, not performance |
| Speed | ~12s to score 20k works | Measured |

### Do not say

| Don't say | Why | Say instead |
|---|---|---|
| "60% precision at detecting fraud" | **Rule-visible** — a rule agreeing with its own injector. Pipeline check, not detection | Held-out figures only |
| "100% recall on pre-sanction payments" | Same — we wrote the rule *and* the injector | — |
| "PR-AUC 0.15" · "7× prevalence" | **Stale.** Pre-dates the generator fix. Real value 0.041 / 1.9× | "About twice the base rate" |
| "788 MPs of data" | We have **543** Lok Sabha members | "The scheme covers 788 MPs; our real dataset covers the 543 Lok Sabha allocation limits" |
| "₹14.7 crore per MP per year" | That's **term-to-date** in our data, not annual | "₹5 crore per year" — that figure is in Para 2.5 of the guidelines |
| "This found real fraud" | Every performance figure is on generated data | "Measured on synthetic data with a sealed held-out split" |
| "Guilty" · "corrupt" · "fraudulent" about a work | The entire product stance | "Flagged for review" |

---

## Likely questions

**"Is this real data?"**
> One real file — official allocation limits for 543 Lok Sabha members across 36
> states. Everything else is generated and we say so on every slide. There is no
> public MPLADS works-and-payments dataset. If MoSPI provides one, the pipeline
> reads it without a code change, because ingestion and detection are separated
> by a frozen contract — that's the whole point of the Gold view.

**"So what's your accuracy?"**
> Depends which number, and they mean different things. On patterns we wrote
> detectors for we do well — but that only proves our code agrees with our own
> test data. On the five nobody was allowed to target, about twice the base rate
> overall and 92.8% on the strongest. Only the second set is a claim, so it's
> the only one we quote.

**"Twice the base rate isn't very high."**
> Agreed, and we'd rather say so than dress it up. Two specifics. Our best
> single layer outperforms the full ensemble at the head of the queue — we've
> measured where that comes from and it reproduces on unseen data, so it's a
> real design problem, not noise. And two-thirds of the corpus currently
> produces no signal at all, which caps recall before ranking quality even
> enters. That's an evidence-coverage problem, not a ranking problem, and it's
> the one we'd fix first.

**"Why noisy-OR rather than a trained model?"**
> Because we have no trustworthy labels. Supervised learning here would train on
> our own injected patterns and learn our generator, which is exactly the trap
> Tanish described. Noisy-OR needs no labels — the calibration reads score
> distributions only — so it can't leak ground truth into the ranking.

**"Why not just use a large language model for detection?"**
> Because it can't cite, and a finding here has to survive an audit — an officer
> must be able to check it against a specific clause. We use a model in exactly
> one place: phrasing clauses our own retrieval already found. It is never asked
> what the rules are.

**"What happens if the system is wrong?"**
> An officer reads the evidence card and disagrees, which is the design. Nothing
> is auto-actioned. Every screen states it is not a finding of wrongdoing, the
> decision is recorded with actor and timestamp, and a dismissal is stored as a
> weak signal — never as proof we were wrong, because a dismissal can also be a
> missed case.

**"Does it work in Indian languages?"**
> Yes, and it's load-bearing rather than a nice-to-have. Descriptions arrive in
> multiple scripts and duplicate detection has to see through that. That's the
> 0.94-versus-0.49 result — and note the baseline is 0.49, so lexical matching
> across scripts is a coin flip.

**"Can it scale?"**
> Twenty thousand works score in about twelve seconds on a laptop. The API and
> the GPU worker are separate services, so heavy jobs queue onto a dedicated
> queue rather than blocking an HTTP request.

**"What isn't built?"**
> Supervised learning, computer-vision checks on site photographs, and drift
> monitoring. The vision work has no input at all today — there are no images —
> so we designed it rather than claiming to have built it.
