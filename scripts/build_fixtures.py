"""Build the committed fixtures.

These are the highest-leverage files in the project. Build Manual 3.6 is right
that committing them is the single most unblocking hour: with a Gold frame and
a set of API JSON responses on disk, five of six seats can write real code
against a stable interface on day one instead of waiting on the generator.

Deliberately small and hand-shaped rather than generator output -- they must
exist *before* the generator does, and they must stay readable enough that a
reviewer can see at a glance which rows are anomalous and why.

    python scripts/build_fixtures.py
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from drishti.config import settings  # noqa: E402
from drishti.contracts.gold import (  # noqa: E402
    GOLD_COLUMNS,
    GOLD_FEATURES,
    validate_frame,
)
from drishti.contracts.labels import FraudLabel, LabelSource  # noqa: E402
from drishti.contracts.layer import (  # noqa: E402
    EvidenceFamily,
    LayerOutput,
    Reason,
    Severity,
)
from drishti.contracts.risk import assess  # noqa: E402
from drishti.domain import FRAUD_PATTERNS, SECTORS  # noqa: E402
from drishti.util import dumps, set_seed  # noqa: E402

N_ROWS = 200
SEED = 42
BASE_DATE = date(2026, 4, 1)

# Rows carrying a deliberately obvious anomaly, so a detector written against
# this fixture has something to find and a reviewer can eyeball correctness.
PLANTED: dict[int, str] = {
    7: "cost_inflation",
    23: "pre_sanction_payment",
    41: "ghost_work",
    58: "duplicate_work",
    77: "advance_without_progress",
    96: "agency_concentration",
    112: "ineligible_work",
    134: "split_payment",
    150: "geographic_displacement",  # held out
    171: "year_end_bunching",  # held out
    188: "photo_reuse",  # held out
}


def _dtype_default(dtype: str, rng: np.random.Generator, n: int):
    if dtype.startswith("int"):
        return rng.integers(0, 100, n)
    if dtype.startswith("float"):
        return rng.random(n)
    if dtype.startswith("datetime"):
        return pd.to_datetime([BASE_DATE] * n)
    return pd.Series([""] * n, dtype="string")


def build_gold() -> pd.DataFrame:
    """A 200-row Gold frame conforming exactly to the Seam A contract."""
    set_seed(SEED)
    rng = np.random.default_rng(SEED)
    n = N_ROWS

    sectors = list(SECTORS)
    sector = rng.choice(sectors, n)
    work_type = np.array([rng.choice(SECTORS[s]) for s in sector])
    states = np.array(["Maharashtra", "Uttar Pradesh", "Bihar", "Tamil Nadu", "Kerala"])

    sanctioned = np.round(rng.lognormal(mean=13.4, sigma=0.55, size=n), 2)
    quantity = np.round(rng.uniform(50, 1200, n), 1)
    progress = np.clip(rng.beta(2.2, 1.6, n) * 100, 0, 100)
    days_since = rng.integers(30, 900, n).astype(float)

    frame = pd.DataFrame(
        {
            "work_id": np.arange(1, n + 1, dtype="int64"),
            "mp_id": rng.integers(1, 40, n),
            "agency_id": rng.integers(1, 25, n),
            "district_id": rng.integers(1, 15, n),
            "vendor_id": rng.integers(1, 60, n).astype("float64"),
            "state": pd.Series(rng.choice(states, n), dtype="string"),
            "constituency": pd.Series(
                [f"Constituency {i % 30 + 1}" for i in range(n)], dtype="string"
            ),
            "sector": pd.Series(sector, dtype="string"),
            "work_type": pd.Series(work_type, dtype="string"),
            "financial_year": np.full(n, 2026, dtype="int64"),
            "estimated_cost": np.round(sanctioned * rng.uniform(0.85, 1.05, n), 2),
            "sanctioned_cost": sanctioned,
            "expenditure_to_date": np.round(sanctioned * (progress / 100) * rng.uniform(0.8, 1.15, n), 2),
            "quantity": quantity,
            "unit_cost": np.round(sanctioned / quantity, 2),
            "unit_cost_vs_sor": np.round(rng.normal(1.0, 0.18, n), 3),
            "unit_cost_peer_percentile": np.round(rng.random(n), 3),
            "cost_deviation_ratio": np.round(rng.normal(0.95, 0.2, n), 3),
            "estimated_to_sanctioned_ratio": np.round(rng.normal(1.02, 0.1, n), 3),
            "status": pd.Series(
                rng.choice(["sanctioned", "in_progress", "completed"], n, p=[0.2, 0.5, 0.3]),
                dtype="string",
            ),
            "progress_pct": np.round(progress, 1),
            "spend_progress_gap": np.round(rng.normal(2.0, 8.0, n), 2),
            "progress_velocity": np.round(rng.gamma(2.0, 3.0, n), 2),
            "progress_acceleration": np.round(rng.normal(0.0, 1.2, n), 3),
            "recommended_on": pd.to_datetime(
                [BASE_DATE - timedelta(days=int(d) + 60) for d in days_since]
            ),
            "sanction_date": pd.to_datetime(
                [BASE_DATE - timedelta(days=int(d)) for d in days_since]
            ),
            "expected_completion_date": pd.to_datetime(
                [BASE_DATE - timedelta(days=int(d)) + timedelta(days=365) for d in days_since]
            ),
            "actual_completion_date": pd.to_datetime([pd.NaT] * n),
            "days_since_sanction": days_since,
            "days_recommendation_to_sanction": rng.integers(10, 120, n).astype("float64"),
            # Uniform on [0, 1], because it is a percentile: the fixture has to
            # exercise the tail the rule keys on, not just the typical case.
            "sanction_delay_peer_percentile": np.round(rng.uniform(0.0, 1.0, n), 4),
            # L5 temporal shape. Drawn over the ranges the real builder
            # produces, and nullable where the real one abstains -- a fixture
            # that is always complete never exercises abstention.
            "progress_roughness": np.round(rng.gamma(1.5, 0.08, n), 4),
            "progress_increment_cv": np.round(rng.beta(2.0, 6.0, n), 4),
            "payment_interval_cv": np.round(rng.gamma(4.0, 0.18, n), 4),
            "sanction_local_density": np.round(rng.gamma(4.0, 0.25, n), 4),
            "peer_survival_at_age": np.round(rng.beta(6.0, 1.5, n), 4),
            "time_to_first_payment": rng.integers(5, 200, n).astype("float64"),
            "is_year_end_sanction": rng.choice([0, 1], n, p=[0.85, 0.15]).astype("int8"),
            "n_payments": rng.integers(0, 8, n),
            "advance_ratio": np.round(rng.beta(1.5, 4.0, n), 3),
            "payment_velocity": np.round(rng.gamma(2.0, 40000, n), 2),
            "max_payment_gap_days": rng.integers(10, 300, n).astype("float64"),
            "has_pre_sanction_payment": np.zeros(n, dtype="int8"),
            "agency_district_share": np.round(rng.beta(2.0, 6.0, n), 3),
            "agency_hhi": np.round(rng.beta(2.0, 8.0, n), 3),
            "agency_centrality": np.round(rng.random(n) * 0.4, 3),
            "mp_agency_affinity": np.round(rng.beta(2.0, 5.0, n), 3),
            "n_works_same_agency": rng.integers(1, 30, n),
            "latitude": np.round(rng.uniform(8.0, 34.0, n), 5),
            "longitude": np.round(rng.uniform(68.0, 96.0, n), 5),
            "geo_in_district": np.ones(n, dtype="int8"),
            "geo_method": pd.Series(["bbox"] * n, dtype="string"),
            "distance_to_district_centroid_km": np.round(rng.gamma(2.0, 6.0, n), 2),
            "description": pd.Series(
                [
                    f"Construction of {wt.replace('_', ' ')} at Ward {i % 25 + 1}"
                    for i, wt in enumerate(work_type)
                ],
                dtype="string",
            ),
            "description_lang": pd.Series(["en"] * n, dtype="string"),
            "description_length": np.zeros(n, dtype="int64"),
            "photo_present": rng.choice([0, 1], n, p=[0.25, 0.75]).astype("int8"),
            # 64-bit perceptual hash, assembled from two 32-bit draws because
            # 16**16 overflows int64.
            "phash": pd.Series(
                [
                    f"{int(rng.integers(0, 2**32)):08x}{int(rng.integers(0, 2**32)):08x}"
                    for _ in range(n)
                ],
                dtype="string",
            ),
            "phash_duplicate_count": np.zeros(n, dtype="int64"),
            "exif_latitude": np.round(rng.uniform(8.0, 34.0, n), 5),
            "exif_longitude": np.round(rng.uniform(68.0, 96.0, n), 5),
            "exif_consistent": np.ones(n, dtype="int8"),
            "is_sc_area": rng.choice([0, 1], n, p=[0.8, 0.2]).astype("int8"),
            "is_st_area": rng.choice([0, 1], n, p=[0.9, 0.1]).astype("int8"),
            "mp_sc_share_pct": np.round(rng.uniform(5, 25, n), 2),
            "mp_st_share_pct": np.round(rng.uniform(2, 15, n), 2),
            "n_missing_fields": np.zeros(n, dtype="int64"),
            "data_quality": np.round(rng.uniform(0.7, 1.0, n), 3),
        }
    )
    frame["description_length"] = frame["description"].str.len().astype("int64")

    # ---- plant the obvious anomalies ----
    for work_id, pattern in PLANTED.items():
        row = work_id - 1
        if pattern == "cost_inflation":
            frame.loc[row, ["unit_cost_vs_sor", "unit_cost_peer_percentile"]] = [2.9, 0.995]
        elif pattern == "pre_sanction_payment":
            frame.loc[row, "has_pre_sanction_payment"] = 1
        elif pattern == "ghost_work":
            frame.loc[row, ["photo_present", "progress_pct", "status"]] = [0, 100.0, "completed"]
            frame.loc[row, "phash"] = pd.NA
        elif pattern == "duplicate_work":
            frame.loc[row, "description"] = frame.loc[57 - 1, "description"]
        elif pattern == "advance_without_progress":
            frame.loc[row, ["advance_ratio", "progress_pct", "spend_progress_gap"]] = [0.92, 1.0, 68.0]
        elif pattern == "agency_concentration":
            frame.loc[row, ["agency_district_share", "agency_hhi"]] = [0.78, 0.64]
        elif pattern == "ineligible_work":
            frame.loc[row, "description"] = "Construction of boundary wall for village temple"
        elif pattern == "split_payment":
            frame.loc[row, ["n_payments", "max_payment_gap_days"]] = [9, 4.0]
        elif pattern == "geographic_displacement":
            frame.loc[row, ["geo_in_district", "distance_to_district_centroid_km"]] = [0, 214.0]
        elif pattern == "year_end_bunching":
            frame.loc[row, "is_year_end_sanction"] = 1
        elif pattern == "photo_reuse":
            frame.loc[row, "phash"] = frame.loc[0, "phash"]
            frame.loc[row, "phash_duplicate_count"] = 3

    # A few rows with genuine gaps, so data_quality is exercised rather than
    # being a constant nobody notices is wrong.
    for row in (12, 45, 90, 160):
        frame.loc[row, ["latitude", "longitude", "exif_latitude", "exif_longitude"]] = np.nan
        frame.loc[row, "geo_in_district"] = pd.NA
        frame.loc[row, "geo_method"] = "unknown"
        frame.loc[row, "quantity"] = np.nan
        frame.loc[row, "unit_cost"] = np.nan

    # Nullable integer columns must use pandas' Int8, not int8: writing pd.NA
    # into a plain int8 column silently coerces the whole column to float, and
    # the fixture then stops being schema-identical to the real Gold view --
    # which is the one property that makes it usable as a stand-in.
    for column in ("geo_in_district", "exif_consistent"):
        frame[column] = frame[column].astype("Int8")

    optional = [s.name for s in GOLD_FEATURES if not s.required]
    frame["n_missing_fields"] = frame[optional].isna().sum(axis=1).astype("int64")
    frame["data_quality"] = (1.0 - frame["n_missing_fields"] / len(optional)).round(3)

    return frame[list(GOLD_COLUMNS)]


def build_labels() -> list[FraudLabel]:
    by_name = {p.name: p for p in FRAUD_PATTERNS}
    return [
        FraudLabel(
            work_id=work_id,
            pattern=pattern,
            injected=True,
            visibility=by_name[pattern].visibility,
            severity=by_name[pattern].severity,
            source=LabelSource.SYNTHETIC_INJECTION,
            parameters={"fixture": True},
        )
        for work_id, pattern in PLANTED.items()
    ]


def build_api_fixtures(frame: pd.DataFrame) -> dict[str, object]:
    """One JSON per endpoint, matching the Seam D shapes exactly."""
    rules = LayerOutput(
        work_id=7,
        layer="rules",
        score=0.80,
        confidence=1.0,
        data_quality=0.95,
        reasons=(
            Reason(
                code="unit_cost_above_peers",
                text="Unit cost is 2.9x the median of 340 comparable works in this sector and state (99.5th percentile).",
                family=EvidenceFamily.FINANCIAL,
                severity=Severity.HIGH,
                provenance="peer_derived",
                factors={"unit_cost_peer_percentile": 0.995, "peer_group_size": 340},
            ),
        ),
        factors={"rule:unit_cost_above_peers": True},
    )
    unsupervised = LayerOutput(
        work_id=7,
        layer="unsupervised",
        score=0.71,
        confidence=0.8,
        data_quality=0.95,
        reasons=(
            Reason(
                code="peer_group_outlier",
                text="Cost and payment pattern sit in the top 1% of this peer group on three features.",
                family=EvidenceFamily.FINANCIAL,
                severity=Severity.MEDIUM,
                provenance="peer_derived",
                factors={"ecod_score": 0.71},
            ),
        ),
    )
    graph = LayerOutput(
        work_id=7,
        layer="graph",
        score=0.66,
        confidence=0.75,
        data_quality=0.9,
        reasons=(
            Reason(
                code="agency_concentration",
                text="This agency holds 78% of the district's works this year (HHI 0.64).",
                family=EvidenceFamily.NETWORK,
                severity=Severity.MEDIUM,
                provenance="peer_derived",
                factors={"agency_district_share": 0.78, "agency_hhi": 0.64},
            ),
        ),
    )

    assessment = assess(
        work_id=7,
        outputs=[rules, unsupervised, graph],
        weights=settings.fusion.weights,
        bands=settings.fusion.bands,
        critical_rules=settings.fusion.critical_rules,
        min_data_quality_for_critical=settings.fusion.min_data_quality_for_critical,
    )

    def summary(row) -> dict[str, object]:
        return {
            "work_id": int(row.work_id),
            "description": str(row.description),
            "sector": str(row.sector),
            "work_type": str(row.work_type),
            "state": str(row.state),
            "district_id": int(row.district_id),
            "status": str(row.status),
            "sanctioned_cost": float(row.sanctioned_cost),
            "progress_pct": float(row.progress_pct),
            "sanction_date": row.sanction_date.date().isoformat(),
            "band": "critical" if row.work_id in PLANTED else "low",
            "overall_risk": 0.86 if row.work_id in PLANTED else 0.12,
            "confidence": 0.88 if row.work_id in PLANTED else 0.55,
            "data_quality": float(row.data_quality),
        }

    head = [summary(r) for r in frame.head(25).itertuples()]
    risk = assessment.to_dict()

    return {
        "works": {"items": head, "total": len(frame), "limit": 25, "offset": 0},
        "work_risk": risk,
        "work_evidence": {
            "work": summary(next(frame[frame.work_id == 7].itertuples())),
            "risk": risk,
            "data_quality": {
                "score": float(frame.loc[6, "data_quality"]),
                "missing_fields": [],
                "geo_method": "bbox",
            },
            "peer_comparison": {
                "peer_group": "sector x work_type x state",
                "peer_group_size": 340,
                "unit_cost_percentile": 0.995,
                "median_peer_unit_cost": 1430.0,
            },
            "duplicate_candidates": [],
            "graph_evidence": {"agency_district_share": 0.78, "agency_hhi": 0.64},
            "timeline": [
                {"at": "2025-06-12", "kind": "recommendation", "label": "Recommended by MP"},
                {"at": "2025-08-02", "kind": "sanction", "label": "Sanctioned", "amount": 2410000.0},
                {"at": "2025-09-18", "kind": "payment", "label": "Advance paid", "amount": 1800000.0},
                {"at": "2026-01-20", "kind": "progress", "label": "Progress update", "progress_pct": 35.0},
            ],
            "recommended_checks": [
                "Request the measurement book and compare quantities against the sanctioned estimate.",
                "Obtain the utilisation certificate and reconcile it against recorded payments.",
                "Confirm the asset location on site against the recorded coordinates.",
            ],
            "disclaimer": "Flagged for review based on statistical and rule-based signals. "
            "This is not a finding of wrongdoing.",
        },
        "alerts": {
            "items": [
                {
                    "alert_id": 1,
                    "work_id": 7,
                    "category": "cost_anomaly",
                    "severity": "high",
                    "band": assessment.band.value,
                    "overall_risk": round(assessment.overall_risk, 4),
                    "confidence": round(assessment.confidence, 4),
                    "status": "open",
                    "created_at": "2026-04-01T09:15:00",
                    "assigned_to": None,
                    "summary": assessment.narrative,
                }
            ],
            "total": 1,
            "limit": 50,
            "offset": 0,
        },
        "alerts_stats": {
            "total": len(PLANTED),
            "by_band": {"low": 0, "medium": 3, "high": 5, "critical": 3},
            "by_status": {"open": 11, "under_review": 0, "resolved": 0, "dismissed": 0},
            "by_family": {"financial": 4, "temporal": 2, "network": 1, "textual": 2, "asset": 2},
            "median_confidence": 0.78,
            "low_confidence_share": 0.27,
        },
    }


def main() -> int:
    fixtures = settings.paths.fixtures
    frame = build_gold()

    problems = validate_frame(frame)
    if problems:
        print("FIXTURE VIOLATES THE GOLD CONTRACT:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    gold_path = fixtures / "sample_gold.parquet"
    frame.to_parquet(gold_path, index=False)

    labels = build_labels()
    (fixtures / "sample_labels.json").write_text(
        dumps([label.to_dict() for label in labels], indent=2), encoding="utf-8"
    )

    api_dir = fixtures / "sample_api"
    api_dir.mkdir(parents=True, exist_ok=True)
    for name, payload in build_api_fixtures(frame).items():
        (api_dir / f"{name}.json").write_text(dumps(payload, indent=2), encoding="utf-8")
        # Also serve them live, so the frontend can hit the API from hour one.
        (settings.paths.api / f"{name}.json").write_text(
            dumps(payload, indent=2), encoding="utf-8"
        )

    held_out = sum(1 for label in labels if label.is_held_out)
    print(f"gold      {gold_path}  ({len(frame)} rows x {len(frame.columns)} cols)")
    print(f"labels    {len(labels)} planted  ({held_out} held out, {len(labels) - held_out} rule-visible)")
    print(f"api       {len(list(api_dir.glob('*.json')))} fixtures in {api_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
