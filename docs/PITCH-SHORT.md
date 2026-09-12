# ARTHA DRISHTI — pitch script (short)

Smart India Hackathon 2026 · SIH26102 · MoSPI

**Runtime ~8 minutes**, six speakers. Plain English throughout; every technical
term is explained in the same breath it is used.

> **Two scripts, one set of numbers.**
> This is the **short, soft-English** version — six speakers, nine beats, minimal
> jargon. Its longer sibling is [`docs/PITCH.md`](PITCH.md): ~11:30, eleven
> beats, considerably more technical, and written so every speaker explicitly
> picks up and hands on what the one before them produced.
>
> Pick one and rehearse it. Do **not** mix beats between them — the detailed
> version's handoffs only work in sequence.
>
> The §Numbers section at the bottom is identical in both and is binding in
> both. If `drishti eval` moves a figure, fix **both** files.

**Why this file lives in the repo.** The script quotes measured numbers. When
those numbers change, this file has to change too — keeping it beside
`docs/HANDOFF.md` is what stops a stale figure being read aloud to judges.
Numbers below were verified on **2026-09-04**. Re-check §Numbers before you
present.

**Speaking order.** Harsh opens and closes. Swap freely — the only thing that
matters is that the person who owns a piece is the person who speaks about it.

| | Speaker | Owns | Slot |
|---|---|---|---|
| 1 | **Harsh** — ML engineer | Rules engine, peer-relative anomaly detection, fusion, evaluation | Open · How it finds things · Close |
| 2 | **Tanish** — Data engineer | Ingestion, synthetic generator, schema, feature view | The data |
| 3 | **Satyam** — ML engineer | Duplicate detection, network analytics | Two harder signals · The proof |
| 4 | **Lakshay** — Backend | FastAPI, alerts, RBAC, copilot, Celery/Redis | The system |
| 5 | **Japleen** — Frontend | Dashboards, review queue | What an officer sees |
| 6 | **Ananya** — Frontend | Evidence card, copilot panel | The evidence card |

---

## 0:00 — 0:50 · Harsh · The problem, and the promise

> Good morning. We're team ARTHA DRISHTI, and we've built a monitoring system
> for the MPLAD Scheme.
>
> Here's the situation we started from. Under MPLADS, every Member of
> Parliament recommends local development works — a school toilet, a village
> road, a solar unit. **788 Members**, across every district in India, year
> after year. Somebody has to check that the money did what it was supposed to
> do. Today that checking is mostly manual, and there is far more of it than
> there are people to do it.
>
> So the obvious idea is: point AI at it, and have it find the fraud.
>
> We deliberately did not build that. And I want to be upfront about why,
> because it shaped every decision after it.
>
> A rule being broken is not the same as something being unusual. Something
> being unusual is not the same as fraud. And a model's confidence is not a
> legal conclusion. If a system blurs those three things, the first person it
> hurts is an honest official with a messy file.
>
> So our system does something narrower and, we think, far more useful.
>
> **It flags works for review. It never issues a verdict.**
>
> It takes an impossible pile of records and hands an officer a short, ordered
> list — with the evidence attached, so they can check it themselves.

*(Beat. Then hand to Tanish.)*

---

## 0:50 — 1:45 · Tanish · The data, and an honest limit

> I handle the data, so let me tell you exactly what we're working with —
> including what we don't have.
>
> We have one real dataset: the official allocation limits for **543 Lok Sabha
> members**, which we ingest, clean and validate. That's real. It's also all
> that's publicly available at this level of detail — there is no open dataset
> of MPLADS works, payments, and site photographs.
>
> So we built one. We wrote a generator that produces around **twenty thousand
> works** — with agencies, payments, progress updates and photographs — anchored
> to that real allocation spine so the money and the geography stay realistic.
>
> And then we did the part that matters. We injected **thirteen known fraud
> patterns** into it, and we split them into two groups.
>
> Eight patterns are **visible** — our team knew about them and could write
> detectors for them.
>
> Five patterns are **held out**. Nobody on the detection side is allowed to
> write anything aimed at those five. They're sealed. Vendor round-tripping,
> year-end bunching, geographic displacement, progress reversal, photo reuse.
>
> That split is the honest core of this project. Anything our system catches in
> the held-out group, it caught **without being told what to look for**. Those
> are the only numbers we'll quote to you as detection.

---

## 1:45 — 2:45 · Harsh · How it finds things

> Right — so what actually does the looking.
>
> The system runs several independent detectors over every work. Think of them
> as different kinds of reader looking at the same file.
>
> The first is a **rules engine**. It's deterministic — no model, no
> probability. It checks things that are simply facts about the record. Was a
> payment dated *before* the work was sanctioned? That's not suspicious, that's
> impossible, and it needs an explanation. Every rule carries its source: this
> one comes from a guideline clause, that one is our own assumption — and the
> screen says which, so an assumption can never borrow the authority of a real
> rule.
>
> The second is **peer-relative anomaly detection**, and this is where most
> systems go wrong. If you compare every work in India to every other work, you
> don't find outliers — you find *sectors*. An expensive metro flyover and an
> expensive rural culvert are both expensive. Only one of them is odd.
>
> So we never compare a work to the population. We compare it to its **peer
> group** — same sector, same work type, same state. "This culvert cost 2.4
> times the median of 340 comparable works" is something a district officer can
> act on. "Anomaly score 0.87" is not.
>
> Then all of these get combined into one priority score. And the key thing
> there is that **two independent signals agreeing is worth far more than one
> loud signal**. In our data, works where two different detectors fire are five
> times more likely to be a genuine problem than the base rate.

---

## 2:45 — 3:30 · Satyam · Two harder signals

> I own the two detectors that look at relationships rather than numbers.
>
> The first is **duplicate detection**. A real failure mode in schemes like this
> is the same work being funded twice under slightly different descriptions —
> and India makes that harder, because those descriptions arrive in different
> languages and scripts. "Construction of school toilet at Ward 21" and the same
> sentence in Hindi are the same work.
>
> So we use a multilingual model that compares *meaning* rather than spelling.
> On a set of thirty-six pairs we wrote and labelled by hand — data our
> generator never touched — it scores **0.94** where a normal word-matching
> approach scores **0.49**. Word-matching is barely better than a coin flip
> across scripts. This isn't.
>
> The second is **network analysis**. Fraud is relational. A work isn't just a
> row — it sits in a web of the Member who recommended it, the agency that built
> it, and the vendor who got paid. We measure general properties of that web:
> how concentrated it is, how closed a vendor's circle of contacts is.
>
> And notice — we deliberately did *not* build a "detect the fraud ring"
> feature, because vendor round-tripping is one of our five sealed patterns.
> We only measure general shape. Which brings me to the number I actually want
> to show you.

---

## 3:30 — 4:20 · Satyam · How we know it works

> On vendor round-tripping — a pattern **nobody was allowed to write code
> against** — the system finds **92.8%** of the injected cases.
>
> That's generalisation. A general measure of network shape caught a specific
> fraud pattern it had never been shown.
>
> Now, I want to be straight with you about the rest, because we think being
> straight is the product here.
>
> Across all five sealed patterns, we're at roughly **twice the base rate** —
> better than chance, and nowhere near solved. Some of those five we catch well.
> Others, like progress reversal, we barely catch at all. We know which is
> which, and it's written down.
>
> And here's the test we're proudest of. Everything I just said was measured on
> one dataset. So we regenerated the whole thing — twice — with completely
> different random seeds, and ran the entire pipeline again on data it had never
> seen.
>
> **Every number held.** Every detector kept the same value, the same ranking,
> the same sign. Nothing in this system is tuned to the sample we developed on.
> That's the difference between a demo and something you could actually deploy.

---

## 4:20 — 5:10 · Lakshay · The system underneath

> I'll be quick on the engineering, but three parts matter.
>
> **Role-based access.** MPLADS has four kinds of user and they must not see the
> same thing. The Ministry sees the country. A state nodal officer sees their
> state. A district officer sees their district — and a work outside their
> district doesn't come back as "access denied", it simply isn't there, because
> telling someone a record exists is itself a leak. A Member sees their own
> portfolio and can't action anything.
>
> **An audit trail that only ever appends.** When a reviewer marks something
> resolved or dismissed, we don't overwrite the previous state — we add to the
> history. Opened, under review, dismissed, reopened. For an accountability
> tool, the sequence *is* the record.
>
> **And a guidelines copilot.** An officer can ask, in plain language, "what
> share of works must be in Scheduled Caste areas?" and get the answer with the
> paragraph number and page from the real 2016 MPLADS guidelines — a hundred and
> twenty-five citable clauses.
>
> One design decision there I'd defend anywhere. The language model is **never
> asked what the guidelines say.** We find the clauses ourselves, locally, and
> the model is only allowed to phrase what we found. Because a copilot that
> invents a guideline is worse than no copilot — an invented clause arrives
> looking exactly as official as a real one.
>
> Which also means it works with no internet and no API key. It just hands you
> the clauses directly.

*(Demo note: this is true today — the copilot runs entirely offline. Nothing on
stage depends on a live API.)*

---

## 5:10 — 5:50 · Japleen · What an officer actually sees

> All of that only matters if it turns into something someone can use on a
> Monday morning.
>
> This is the district view. One ordered queue — the works most worth your time,
> at the top. Not twenty thousand rows. Thirteen.
>
> Two things on this screen we argued about a lot.
>
> First — we show **risk and confidence separately**, and we refuse to merge
> them. A work can look very concerning on thin evidence. That's a lead: make a
> phone call. Another can look concerning with four independent kinds of
> evidence behind it. That's a case: send someone. A single score makes those
> two look identical, and an officer would treat them the same. So we don't.
>
> Second — that counter there says how many of the flagged works are
> **thinly evidenced**. We put our own weakest results on the front page,
> permanently, because an officer deserves to know how much of their queue is
> soft.
>
> And the same components serve all four roles. Switch to Ministry and it groups
> by state; switch to a Member and it becomes their own portfolio.

---

## 5:50 — 6:30 · Ananya · The evidence card

> When you click a work, you get this — and this is the actual product. Not the
> score. This.
>
> It tells you **why**, in sentences. "The unit cost is 2.4 times the median of
> 340 comparable works, in the highest 1.8% of that group." Not a number — a
> comparison, with the group size, so you can judge whether it means anything.
>
> Next to every finding is where its threshold came from. If it's from a
> guideline clause, it says so. If it's our own assumption, it says
> **"project assumption — not verified"** in plain sight. We could have hidden
> that. It would have looked more confident. It would also have been the exact
> thing this system exists to prevent.
>
> Then the timeline. Then what's missing from the record, because gaps change
> what a finding means.
>
> And it ends with **what to actually check** — request the utilisation
> certificate, verify the measurement book, inspect the site. A verifiable next
> step, not a conclusion.
>
> Every card carries the same line at the bottom: *flagged for review based on
> statistical and rule-based signals; this is not a finding of wrongdoing.*

---

## 6:30 — 7:20 · Harsh · The honest part, and the close

> I want to close on something that isn't a feature.
>
> Late in the build, our headline detection number was about **three and a half
> times better** than what we just showed you. We were pleased with it.
>
> Then we went back and audited our own data generator, and found that the way
> it injected one fraud pattern was accidentally creating two *unrelated*
> violations as a side effect. Two of our rules were quietly picking up that
> side effect. The system wasn't detecting year-end bunching. It was detecting
> our own generator.
>
> Nobody outside this room would ever have known. We fixed the generator, and
> our best number dropped by two thirds — to what you saw today.
>
> We think that's the most important slide in this pitch. Because a tool that
> touches public money and an official's reputation is only worth having if it
> tells you the truth when the truth is inconvenient. We built the discipline
> into the code: **eight hundred and eighty-eight automated tests**, and an
> eleven-point gate the whole pipeline has to pass before it will publish
> anything.
>
> So — what we're offering isn't a fraud detector. It's a way to make oversight
> *possible* at the scale MPLADS actually runs at. A short, ordered, evidence-
> backed queue, where a human being still makes every decision.
>
> It flags works for review. It never issues a verdict.
>
> Thank you.

---

## Numbers — what you may and may not say

**Verified 2026-09-04.** Re-run `python -m drishti eval` before presenting; if
anything below has moved, fix this file first.

### Safe to quote

| Figure | Value | Why it's safe |
|---|---|---|
| Vendor round-tripping recall | **92.8%** | Held-out pattern — no detector was written against it |
| Multilingual duplicates vs word-matching | **0.94 vs 0.49** ROC-AUC | Measured on 36 hand-written pairs the generator never produced |
| Overall held-out performance | **~1.9× the base rate** | Honest and unflattering — say it as "better than chance, not solved" |
| Stability across seeds | Every layer's value unchanged on 2 unseen datasets | Strongest engineering claim we have |
| Scale | 19,875 works · 543 real MPs · 125 guideline clauses | Counts, not performance |
| Test suite / gate | 888 tests · 11-check acceptance gate | Counts, not performance |
| Corroboration | Two detectors agreeing ≈ **5× the base rate** | Measured |

### Do NOT say

| Don't say | Why | Say instead |
|---|---|---|
| "We detect fraud with 60% precision" | That's the **rule-visible** number — a rule agreeing with the injector that created the pattern. It is a pipeline check, not detection. | Quote the held-out figures only |
| "100% recall on pre-sanction payments" | Same problem — we wrote the rule *and* the injector | — |
| "PR-AUC 0.15" / "7× prevalence" | **Stale.** Pre-dates the generator fix. Real value is 0.041, 1.9× | 1.9× the base rate |
| "788 MPs of data" | We have data for **543** Lok Sabha members | "The scheme covers 788 MPs; our real dataset covers the 543 Lok Sabha allocation limits" |
| "₹14.7 crore per MP per year" | That's a **term-to-date** figure in our data, not annual | "₹5 crore per year", citing the guidelines — that figure is in Para 2.5 |
| "This found real fraud" | Every performance figure is on data we generated | "This is measured on synthetic data with a sealed held-out split" |
| Anything with the word "guilty", "corrupt", or "fraudulent" about a work | The whole product stance | "Flagged for review" |

---

## Likely questions, and honest answers

**"Is this real data?"**
> One real file — the official allocation limits for 543 Lok Sabha members.
> Everything else is generated, and we say so on every slide. There is no public
> MPLADS works-and-payments dataset; if MoSPI gives us one, the pipeline reads
> it without a code change, because ingestion and detection are separated by a
> fixed contract.

**"So what's your accuracy?"**
> Depends which number you want, and they mean different things. On patterns we
> wrote detectors for, we do well — but that only proves our code agrees with
> our own test data. On the five patterns nobody was allowed to target, we're at
> about twice the base rate overall, and 92.8% on the strongest of them. That
> second set is the only one that's a real claim, so it's the one we quote.

**"Twice the base rate isn't very high."**
> Agreed, and we'd rather say that than dress it up. Two things. Our best single
> component performs considerably better on its own than the combination does —
> we've measured exactly where that's coming from, and it's our next block of
> work. And two-thirds of the corpus currently produces no signal at all, which
> is an evidence-coverage problem, not a ranking problem. We know the difference
> and we know which to fix first.

**"What happens if the AI is wrong?"**
> Then an officer reads the evidence card and disagrees, which is the design.
> Nothing is auto-actioned. Every screen says it is not a finding of wrongdoing,
> the reviewer's decision is recorded with their name and the time, and a
> dismissal is kept as a weak signal — never as proof we were wrong, because a
> dismissal can also be a missed case.

**"Why not use ChatGPT / a large language model for the detection?"**
> Because it can't cite. Our detections have to survive an audit — a district
> officer has to be able to check a finding against a specific guideline clause.
> We use a language model in exactly one place: phrasing clauses that our own
> local retrieval already found. It's never asked what the rules are.

**"Does it work in Indian languages?"**
> Yes, and that's load-bearing rather than a nice-to-have. Work descriptions
> arrive in multiple scripts, and duplicate detection has to see through that.
> That's the 0.94-versus-0.49 result.

**"Can it scale?"**
> Twenty thousand works score in about twelve seconds on a laptop. The
> architecture splits the API from a GPU worker, so heavy jobs queue instead of
> blocking a request.

**"What's not built yet?"**
> Supervised learning, computer-vision checks on site photographs, and drift
> monitoring. The photo work has no input today — there are no images to train
> on — so we designed it rather than pretending to build it.
