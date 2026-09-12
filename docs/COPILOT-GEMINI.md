# Wiring the Gemini free tier into the analyst copilot

How to give ARTHA DRISHTI's copilot a Google Gemini key, verify it, and read
the failure when it does not work.

**Read §1 before doing anything else.** It is a hundred words and it decides
whether you need a key at all.

---

## 1. What the key actually buys

The copilot has two halves, and they fail independently:

| half | what it does | needs a key? | what happens without it |
|---|---|---|---|
| **retrieval** | finds the guideline clauses that answer the question, with paragraph numbers and page numbers | **no** | works, offline, always |
| **generation** | phrases those clauses into a short answer | **yes** | the clauses are returned verbatim instead |

**Retrieval is the substance. The model is a phrasing layer over it.** The
model is never asked *what the guidelines say* — it is handed the clauses
retrieval already found and asked to phrase them. That ordering is the whole
design: a copilot that invents a guideline is worse than no copilot, because
an invented clause reaches an investigator wearing exactly the same authority
as a real one.

So a missing, blocked, or rate-limited key degrades the copilot. It never
breaks it, and it never makes it wrong. If the key is more trouble than it is
worth on the day, ship without one — the demo still answers, still cites, and
still says which mode it is in.

> **On the submission.** An API key is a live credential and a dependency on a
> third party during a judged demo. The offline path exists so that neither is
> load-bearing. Open question **D-07** in `docs/HANDOFF.md` is exactly this
> decision and it has not been made.

---

## 2. Get a key

> ### Read this before choosing a route
>
> Google changed what a Gemini key *is*. There are now two kinds:
>
> | kind | bound to | Gemini API accepts it? |
> |---|---|---|
> | **authorization key** | a Google Cloud service account | **yes** |
> | **standard key** | nothing — it just names a project for billing | **no, as of September 2026** |
>
> Unrestricted standard keys were rejected first (mid-2026); since **September
> 2026** the Gemini API rejects standard keys outright. A standard key returns
> `API_KEY_SERVICE_BLOCKED`, and **it cannot be repaired by editing its
> restrictions** — the Cloud console greys the *Gemini API* entry out with
> *"This API requires authentication with a service account-bound API key"*.
> There is no box to tick.
>
> **Route A creates an authorization key for you and is the route to use.**
> Route B is kept only for a project whose keys must live in a specific
> organisation, and it carries the org-policy caveat at the end of this section.

### Route A — Google AI Studio (recommended, ~2 minutes)

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. **Create API key**.
3. Either let it create a new project, or pick an existing Google Cloud project.
4. Copy the key. It is shown once.

**Every key AI Studio issues today is an authorization key**, bound to a service
account it manages for you, and it enables the Generative Language API on the
project at the same time. No `gcloud`, no service account to create by hand.
This is the route that avoids §6 entirely.

### Route B — Google Cloud console

Use this when the key must live in a specific organisation project — an
institutional account, or a project with billing and quota already set up.

1. <https://console.cloud.google.com/> → select or create a project.
2. **APIs & Services → Library** → search **Generative Language API** →
   **Enable**. *(Skipping this is the single most common cause of a dead key.
   See §6.)*
3. **APIs & Services → Credentials → Create credentials → API key**.
4. **Restrict key**:
   - *Application restrictions*: **None**. The copilot calls Google from the
     API server, not from a browser. An HTTP-referrer restriction makes a
     server-side call fail with `API_KEY_HTTP_REFERRER_BLOCKED`.
   - *API restrictions*: **Restrict key** → find **Gemini API**.
     **If it is greyed out**, this project is issuing standard keys and the
     tooltip will say *"This API requires authentication with a service
     account-bound API key"*. Stop — a key made here will not work. Use Route A.
5. Save, and copy the key.

> **Org-policy caveat.** Binding an API key to a service account is blocked by a
> default organization policy constraint. On a personal Google account this
> never comes up, because AI Studio manages the binding. On a Workspace,
> institutional or corporate account an administrator may have to allow the
> constraint before *any* working Gemini key can be issued. If Route A also
> fails on your account, this is why — and it is an admin request, not something
> to solve in code.

**Free tier, and what it costs.** The Gemini API has a no-cost tier with
per-minute and per-day request limits, and a project with no billing account
attached cannot exceed it — it returns `429` instead of a bill. The specific
limits change often enough that quoting them here would age badly; read them
at <https://ai.google.dev/gemini-api/docs/rate-limits> before planning a demo
around throughput. For this copilot the volume is a handful of requests per
session, which is far inside any tier Google has offered.

---

## 3. Put the key in `.env`

`.env` is git-ignored and must stay that way. Never commit a key.

```bash
# in the repo root
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash
```

`.env.example` ships both lines with the comment block explaining them; copy
it if you have no `.env` yet:

```bash
cp .env.example .env
```

Notes:

- **`LLM_API_KEY` is read as a fallback** so an older deployment keeps working,
  but `GEMINI_API_KEY` is the name to use and it wins when both are set.
- **A blank value counts as absent**, which is the intended way to turn
  generation off without deleting anything.
- **`GEMINI_MODEL` is read per call**, so changing it takes effect on the next
  request rather than the next process start. `gemini-2.0-flash` is the default
  and is the cheapest model that follows the citation instruction reliably;
  `gemini-2.5-flash` also works. Set it to a model your key can actually reach
  — a name the key cannot see returns `404`, and §6 names that case.

---

## 4. Docker: the passthrough that is easy to miss

**Setting the key in `.env` is not enough for `drishti up`, and the failure is
silent.** Only `./backend` and `./data` are mounted into the containers, so
`.env` does not exist at `/app/.env` and the loader that reads it finds
nothing. Compose interpolates `${...}` on the *host*, so the variables have to
be forwarded explicitly.

`docker-compose.yml` now does that for both services that can run the copilot:

```yaml
    environment:
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      GEMINI_MODEL: ${GEMINI_MODEL:-gemini-2.0-flash}
      LLM_API_KEY: ${LLM_API_KEY:-}
```

After editing `.env`, recreate the container — a restart does **not** re-read
the environment:

```bash
docker compose up -d api
```

Confirm the container actually received it:

```bash
curl -s -H "X-Drishti-Role: ministry" http://localhost:8000/api/copilot/status
```

`"key_configured": true` means the passthrough worked. It says nothing about
whether the key is *valid* — §5 is what tests that.

---

## 5. Verify it

```bash
python -m drishti copilot
```

This makes one real call carrying no project data — a two-token connectivity
prompt — because every failure that matters here is invisible until something
is actually sent. A healthy setup:

```
copilot

  [OK  ] guidelines corpus
         125 citable clauses from MPLADS Guidelines (MoSPI, June 2016)
  [OK  ] gemini generation
         model gemini-2.0-flash, key from GEMINI_API_KEY

The copilot is usable.
```

Ask it something:

```bash
python -m drishti copilot "What share of works must be in Scheduled Caste areas?"
```

`generated_by: gemini` means the model phrased it. `generated_by: retrieval`
means it did not, and the `warning:` line says why.

In the UI, the copilot panel sits under every role. The badge on each answer
says **phrased by Gemini** or **clauses, verbatim**, and the clauses are shown
either way — never behind a disclosure, because evidence one click away is
evidence nobody checks.

Other entry points:

| where | what |
|---|---|
| `GET /api/copilot/status` | configuration only, no provider call — safe to poll |
| `POST /api/copilot/query` | `{"question": "..."}` |
| `POST /api/copilot/explain/{work_id}` | plain-language brief for one flagged work |

---

## 6. When it does not work

A `403` from this API has three unrelated causes with three unrelated fixes,
so the copilot reads Google's machine-readable `reason` code and turns it into
one sentence. It never reads the provider's *message* text — an error body can
echo the request back, and the request carries guideline extracts.

Find the reason in `python -m drishti copilot`, in the API server log, or in
the warning on the answer itself.

| reason | what is wrong | fix |
|---|---|---|
| `API_KEY_SERVICE_BLOCKED` | **usually: it is a standard key.** Since September 2026 the Gemini API accepts only service-account-bound *authorization* keys. Occasionally, on an older key that used to work: the Generative Language API is disabled for its project | **issue a new key at [AI Studio](https://aistudio.google.com/apikey)** — §2 route A. Editing the key's restrictions cannot fix this; the console greys the entry out |
| `SERVICE_DISABLED` | Generative Language API disabled for the project | enable it |
| `API_KEY_INVALID` | not a Gemini key, or mistyped | reissue at <https://aistudio.google.com/apikey> |
| `API_KEY_HTTP_REFERRER_BLOCKED` | key restricted to browser referrers | set *Application restrictions* to **None** |
| `API_KEY_IP_ADDRESS_BLOCKED` | key is IP-restricted, this host is not listed | add the host, or drop the restriction |
| `RESOURCE_EXHAUSTED` / `429` | free-tier quota or rate limit hit | wait; it resets on its own |
| `404` | `GEMINI_MODEL` names a model this key cannot reach | set it to one it can, e.g. `gemini-2.0-flash` |

Two failures that are not the key:

- **`key_configured: false` while `.env` has a key** — the process did not get
  the variable. Natively: you are running from a directory whose repo root has
  no `.env`. In Docker: §4.
- **`corpus_available: false`** — nothing to do with Gemini. The guidelines
  text is missing from `data/guidelines/`. A PDF alone is not searchable; there
  must be an extracted `.txt` beside it, and a `SOURCE.md` recording the
  edition. The copilot refuses to answer at all in this state rather than
  answering from model memory, which is the correct behaviour.

### Worked example — the failure this project actually hit

`.env` carried a key that looked fine and every call fell back to retrieval.
The old code logged `Gemini returned 403` and told the operator to *set*
`GEMINI_API_KEY` — advice that could never have worked, because the key was
already set and already valid.

The reason code was `API_KEY_SERVICE_BLOCKED` on
`generativelanguage.googleapis.com`, project `853014309402`.

The first reading was "the API is switched off for that project, go and enable
it." **That was wrong**, and the Cloud console said so as soon as anyone looked
at the key's restriction list: *Gemini API* was **greyed out and unselectable**,
with the tooltip

> This API requires authentication with a service account-bound API key

which is Google saying the standard-key era is over for this API. The key was
not misconfigured and the project was not missing a switch — the key was simply
**the wrong kind of key**, and no edit to it could have made it the right kind.

The fix is a new authorization key from AI Studio (§2 route A). The lesson is
narrower than "read the reason code": a reason code told us *which* call was
refused, and the console tooltip told us *why the obvious fix was unavailable*.
Both were needed.

---

## 7. Security

- **The key travels as an `x-goog-api-key` header, never in the URL.** A key in
  a query string lands in proxy logs, browser history and referrer headers. A
  test pins this.
- **The key is never logged, never returned in a response, and never
  persisted.** Tests pin all three.
- **What leaves the machine**, when a key is configured: the user's question,
  the retrieved guideline clauses, and — for `explain` — the finding texts for
  one work. The MPLADS guidelines are a public document. The finding texts are
  peer-comparison sentences, not identities. No key, and nothing leaves at all.
- **Rotate a key that has been pasted into a terminal, a screenshot, a chat, or
  a CI log.** Revoking is one click in AI Studio or the Cloud console.
- **`.env` is git-ignored.** Keep it that way; do not add it to a commit "just
  this once".

---

## 8. What the copilot will not do

Enforced by the system instruction and by tests, not by convention:

- It answers **only** from the supplied clauses. If they do not answer the
  question it says so and stops, rather than supplying a rule from the model's
  own knowledge.
- It cites a paragraph number for every factual claim.
- It **never states or implies that a work, official or Member is fraudulent,
  corrupt or in breach.** The whole system flags for review and does not issue
  verdicts, and a chat box is exactly where that discipline erodes first.
- Every answer carries a disclaimer saying it is not legal advice and not a
  finding about anyone.

Temperature is 0.1. Creative phrasing of a legal clause is not a feature.

---

## See also

- `docs/adr/0017-injector-artifact-and-real-guidelines.md` — where the
  guidelines corpus came from, and open question D-09
- `docs/HANDOFF.md` §11 — D-07, the undecided local-vs-hosted question
- `backend/drishti/copilot/` — service, corpus, and the tests that pin all of
  the above
