/**
 * Seam D types, mirroring backend/drishti/api/models.py.
 *
 * The four risk quantities are separate fields here for the same reason they
 * are separate in the contract: a UI given one number renders a thinly
 * evidenced lead and a four-way corroborated finding identically, and an
 * officer acts on both the same way.
 */

export type Band = "low" | "medium" | "high" | "critical";
export type Severity = "low" | "medium" | "high" | "critical";
export type EvidenceFamily =
  | "financial"
  | "temporal"
  | "network"
  | "textual"
  | "asset"
  | "compliance";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkSummary {
  work_id: number;
  description: string;
  sector: string;
  work_type: string;
  state: string;
  district_id: number;
  status: string;
  sanctioned_cost: number;
  progress_pct: number;
  sanction_date: string | null;
  band: Band;
  overall_risk: number;
  confidence: number;
  data_quality: number;
}

export interface Reason {
  code: string;
  text: string;
  family: EvidenceFamily;
  severity: Severity;
  /** guideline_clause | cag_finding | peer_derived | assumed */
  provenance: string;
  factors: Record<string, unknown>;
}

export interface Risk {
  work_id: number;
  overall_risk: number;
  confidence: number;
  severity: Severity;
  data_quality: number;
  band: Band;
  corroborating_families: EvidenceFamily[];
  layer_scores: Record<string, number>;
  reasons: Reason[];
  narrative: string;
  escalated_by_rule: string | null;
}

export interface TimelineEvent {
  at: string;
  kind: string;
  label: string;
  amount?: number | null;
  progress_pct?: number | null;
}

export interface PeerComparison {
  peer_group: string;
  peer_group_size: number;
  unit_cost: number | null;
  unit_cost_percentile: number | null;
  median_peer_unit_cost: number | null;
  sufficient_peers: boolean;
}

export interface EvidenceCard {
  work: WorkSummary;
  risk: Risk;
  data_quality: {
    score: number;
    missing_fields: string[];
    geo_method: string;
  };
  peer_comparison: PeerComparison;
  graph_evidence: Record<string, number | null>;
  timeline: TimelineEvent[];
  recommended_checks: string[];
  disclaimer: string;
}

export interface AlertStats {
  total: number;
  by_band: Record<string, number>;
  by_status: Record<string, number>;
  by_family: Record<string, number>;
  median_confidence: number;
  /** Share of flagged works below the actionable confidence threshold. */
  low_confidence_share: number;
}

/** band >= high AND confidence >= 0.6. Mirrors RiskAssessment.is_actionable. */
export const ACTIONABLE_CONFIDENCE = 0.6;

export function isActionable(work: {
  band: Band;
  confidence: number;
}): boolean {
  return (
    (work.band === "high" || work.band === "critical") &&
    work.confidence >= ACTIONABLE_CONFIDENCE
  );
}

/** Rupees in the units an Indian officer reads. */
export function formatMoney(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} lakh`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// analytics -- mirrors the models added for Blueprint §10 and §11.
//
// Every aggregate carries `disclaimer` for the same reason the evidence card
// does: a district ranked worst in a table is the easiest thing in the product
// to misread as an accusation, and an aggregate has no reasons attached for a
// reader to argue with.
// ---------------------------------------------------------------------------
export interface Kpis {
  n_works: number;
  sanctioned_total: number;
  expenditure_total: number;
  utilisation_pct: number;
  completed_pct: number;
  /** works in band high or critical */
  flagged: number;
  flagged_pct: number;
  critical: number;
  /** band >= high AND confidence >= 0.6 */
  actionable: number;
  median_data_quality: number;
  /** rupee value under review, never value established as misused */
  value_flagged: number;
}

export interface GroupRow {
  key: string | number;
  n_works: number;
  flagged: number;
  flagged_pct: number;
  critical: number;
  sanctioned_total: number;
  utilisation_pct: number;
  completed_pct: number;
  mean_risk: number;
}

export interface NationalAnalytics {
  scope: string;
  kpis: Kpis;
  by_state: GroupRow[];
  worst_districts: GroupRow[];
  worst_agencies: GroupRow[];
  by_sector: GroupRow[];
  pattern_mix: Record<string, number>;
  disclaimer: string;
}

export interface StateAnalytics {
  state: string;
  kpis: Kpis;
  by_district: GroupRow[];
  by_sector: GroupRow[];
  worst_agencies: GroupRow[];
  pattern_mix: Record<string, number>;
  disclaimer: string;
}

export interface DistrictAnalytics {
  district_id: number;
  state: string;
  kpis: Kpis;
  by_agency: GroupRow[];
  by_sector: GroupRow[];
  /** Herfindahl index of agency share, Blueprint §4.4 */
  agency_hhi: number;
  top_agency_share_pct: number;
  pattern_mix: Record<string, number>;
  disclaimer: string;
}

export interface MPAnalytics {
  mp_id: number;
  state: string;
  constituency: string | null;
  kpis: Kpis;
  by_status: Record<string, number>;
  by_sector: GroupRow[];
  sc_share_pct: number;
  st_share_pct: number;
  flagged_works: WorkSummary[];
  /** separates recommending a work from sanctioning and executing it */
  note: string;
  disclaimer: string;
}

export interface EarmarkRow {
  mp_id: number;
  state: string;
  constituency: string | null;
  n_works: number;
  sanctioned_total: number;
  sc_share_pct: number;
  st_share_pct: number;
  sc_shortfall_pct: number;
  st_shortfall_pct: number;
  sc_compliant: boolean;
  st_compliant: boolean;
}

export interface EarmarkReport {
  items: EarmarkRow[];
  total: number;
  limit: number;
  offset: number;
  sc_threshold_pct: number;
  st_threshold_pct: number;
  /** the denominator caveat -- this is not a share of the annual entitlement */
  basis: string;
  provenance: string;
  citation: string;
  disclaimer: string;
}

export interface GraphEdge {
  id: string | number;
  n_works: number;
  share_pct: number;
}

export interface AgencyGraph {
  agency_id: number;
  districts: number[];
  n_works: number;
  district_share_pct: number;
  agency_hhi: number;
  centrality: number;
  flagged: number;
  flagged_pct: number;
  members: GraphEdge[];
  payees: GraphEdge[];
  sectors: GraphEdge[];
  note: string;
  disclaimer: string;
}

export interface DuplicatePair {
  work_id: number;
  match_work_id: number | null;
  similarity: number | null;
  semantic: number | null;
  lexical: number | null;
  distance_km: number | null;
  /** embedding backend -- sparse and dense scores are not on the same scale */
  method: string | null;
  text: string;
  district_id: number;
}

export interface DuplicatePage extends Page<DuplicatePair> {
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// review workflow -- Blueprint §11, §16.5
// ---------------------------------------------------------------------------
export type AlertStatus = "open" | "under_review" | "resolved" | "dismissed";

export type ReviewOutcome =
  | "confirmed_issue"
  | "false_positive"
  | "insufficient_evidence"
  | "duplicate_alert"
  | "requires_field_inspection";

export interface Alert {
  /** the work id -- one flagged work is one alert */
  alert_id: number;
  work_id: number;
  category: string;
  severity: Severity;
  band: Band;
  overall_risk: number;
  confidence: number;
  status: AlertStatus;
  created_at: string;
  assigned_to: string | null;
  summary: string;
}

export interface AlertAction {
  status: AlertStatus;
  /** a weak label, never ground truth: a dismissal may be a missed case */
  outcome?: ReviewOutcome | null;
  note?: string;
}

export interface ReviewEvent {
  alert_id: number;
  reviewed_at: string;
  reviewer: string;
  from_status: AlertStatus;
  to_status: AlertStatus;
  outcome: ReviewOutcome | null;
  note: string;
}

export interface AlertActionResult {
  alert: Alert;
  event: ReviewEvent;
  history: ReviewEvent[];
}

// ---------------------------------------------------------------------------
// analyst copilot -- Blueprint §6, §10, §16.6
// ---------------------------------------------------------------------------

/** One guideline clause an answer rests on. */
export interface CopilotSource {
  clause: string;
  page: number;
  source: string;
  citation: string;
  text: string;
  relevance: number | null;
}

export interface CopilotAnswer {
  question: string;
  answer: string;
  sources: CopilotSource[];
  /**
   * Part of the contract, not debug output. A reader is entitled to know
   * whether a sentence was phrased by a model or handed to them verbatim from
   * the guidelines -- and `sources` lets them check it either way.
   */
  generated_by: "gemini" | "retrieval" | "unavailable";
  corpus: string;
  warning: string | null;
  disclaimer: string;
}

/**
 * Retrieval and generation are reported separately because they fail for
 * unrelated reasons. Retrieval is what the copilot promises and works
 * offline; generation is a phrasing layer that is allowed to be absent.
 */
export interface CopilotStatus {
  corpus_available: boolean;
  corpus_source: string;
  n_chunks: number;
  corpus_problem: string | null;
  key_configured: boolean;
  model: string;
  generation_ok: boolean;
  generation_problem: string | null;
}
