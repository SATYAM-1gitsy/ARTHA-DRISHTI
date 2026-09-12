# ADR 0002 — What the GPU is for, and what it is not for

- **Status:** accepted
- **Date:** 2026-08-29

## Context

The brief asks for aggressive use of the machine's RTX 5070 across deep tabular
models, autoencoders, sequence models, Transformers, GNNs, vision encoders and
multimodal fusion. Measuring the machine first changed the conclusion.

**Measured, not assumed:**

| | |
|---|---|
| Device | NVIDIA GeForce RTX 5070 **Laptop** GPU |
| VRAM | 8150 MB (the desktop 5070 has 12 GB) |
| Compute capability | 12.0 — Blackwell, `sm_120` |
| Driver / CUDA | 610.62 / 13.3 |
| Verified working | `torch 2.13.0+cu130`, bf16 supported |

## Decision 1 — Guard against the CPU-only wheel in code

On Windows, `pip install torch` resolves to the PyPI wheel, which has no CUDA.
It imports cleanly, `torch.cuda.is_available()` returns `False`, and every model
trains on CPU while appearing to work. That failure is silent and expensive.

`gpu.py` makes it loud in three places: `drishti gpu --require` exits non-zero,
`/health` returns `gpu_usable` so the dashboard shows it, and the frontend
renders the correct install command when it is false.

`MIN_COMPUTE_CAPABILITY = (12, 0)`. `sm_120` kernels ship only in CUDA 12.8+
builds — `cu121` and `cu124` install happily and then die at the first kernel
launch with *no kernel image is available for execution on the device*. Verified
available for cp314 Windows: `cu128` → torch 2.11, `cu129` → torch 2.9,
`cu130` → torch 2.13.

## Decision 2 — VRAM is not the binding constraint; treat it accordingly

8 GB holds every architecture in the brief except a local LLM above roughly 7B
in 4-bit. A multilingual MiniLM is under 500 MB. CLIP ViT-B/32 is smaller. An
FT-Transformer over 50,000 works × 80 features is a few million parameters.

**The models are small. The datasets are what is small.** This GPU will sit
near-idle through the tabular, temporal and anomaly work — not from poor
engineering, but because those jobs finish before the card leaves its idle power
state. Manufacturing neural work to justify the hardware is explicitly rejected.

The GPU earns its keep in five places, and the training infrastructure is built
around these rather than around a general "accelerate everything" goal:

1. text embedding generation at corpus scale
2. cross-encoder reranking for duplicate detection
3. GNN training
4. LoRA fine-tuning, if it is ever justified
5. serving a local LLM for the copilot

Two secondary constraints do bite: this is a laptop part, so sustained training
throttles and its power budget is well below the desktop card's — benchmark
under sustained load, not in 30-second bursts. And it is the only GPU, so a
resident copilot model and a training run contend for the same 8 GB.
`GPUConfig.vram_headroom_mb` reserves space rather than allowing a run to
consume all of it.

## Decision 3 — Deep models are challengers, not defaults

Each must beat a named baseline on ranking quality, calibration, robustness and
inference cost, or it is dropped. Recorded now so the ablation in Block 15 has
something to test against:

| Layer | Position taken | Baseline it must beat |
|---|---|---|
| L1 deep anomaly (AE / VAE / Deep SVDD) | build as ablation; expected to add little over peer-relative statistics | Isolation Forest + ECOD |
| L2 deep tabular (FT-Transformer, TabTransformer) | challenger; categorical entity embeddings are the piece with independent value | LightGBM |
| L5 sequence (LSTM, GRU, TCN, TFT) | **rejected** — a work carries ~6–12 events, far too short | rolling statistics + survival analysis |
| L4 NLP (bi-encoder → cross-encoder) | **implement** — the strongest deep-learning case in the project | TF-IDF + lexical similarity |
| L3 graph (GraphSAGE, GAT, heterogeneous GNN) | investigate; must beat explainable classical analytics | HHI, eigenvector centrality, Louvain |
| L6 vision (CLIP, DINO, ViT) | **no input** — metadata-only checks | pHash + EXIF |
| Document AI (OCR, doc embeddings) | **no input** | — |
| Multimodal fusion | deferred until three genuinely independent modalities exist | — |
| Uncertainty (conformal, deep ensembles) | **implement early** — highest value per unit cost; supplies the `confidence` field | — |
| Learned fusion (stacking) | **implement** — the correct fix for correlated layers | weighted sum |

Note that "no input" and "rejected" above are data verdicts, not hardware ones.

## Consequences

- Every deep model in this project trains on data the team generates, so its
  metrics are a **capability demonstration**, not a performance claim. The
  evaluation harness must label the two differently, and the pitch must repeat
  the distinction.
- One constructive option for L6 remains open: source a few hundred real
  public-infrastructure photographs from an open dataset and run genuine
  retrieval and duplicate detection over real pixels, labelled as a stand-in
  corpus. Stronger than a CV pipeline over images we rendered ourselves.
