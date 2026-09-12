/**
 * Typed API client.
 *
 * baseUrl comes from an env var so the whole frontend can be pointed at
 * static fixture JSON during development and at the live API later, by
 * changing one value rather than touching any component (Manual 3.6, 9.4).
 */

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

/** Mirrors backend/drishti/api/app.py::HealthResponse. */
export interface Health {
  status: string;
  service: string;
  version: string;
  accelerator: string;
  gpu_usable: boolean;
  fixtures_available: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The signed-in role and jurisdiction, as request headers.
 *
 * A real deployment carries these as claims in a signed JWT. Here they are set
 * from the role switcher, which is a development stand-in and not a security
 * boundary -- the API says so on /health, and the UI says so in the footer.
 */
export interface Principal {
  role: "ministry" | "state_nodal" | "district" | "mp";
  state?: string;
  district_id?: number;
  mp_id?: number;
  subject?: string;
}

let principal: Principal = { role: "ministry", subject: "mospi.analyst" };

export function setPrincipal(next: Principal): void {
  principal = next;
}

export function getPrincipal(): Principal {
  return principal;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "X-Drishti-Role": principal.role };
  if (principal.state) headers["X-Drishti-State"] = principal.state;
  if (principal.district_id !== undefined)
    headers["X-Drishti-District"] = String(principal.district_id);
  if (principal.mp_id !== undefined) headers["X-Drishti-MP"] = String(principal.mp_id);
  if (principal.subject) headers["X-Drishti-Subject"] = principal.subject;
  return headers;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { signal, headers: authHeaders() });
  } catch (cause) {
    // A network-level failure here almost always means the API is not
    // running, so say that rather than surfacing "Failed to fetch".
    throw new ApiError(
      `Cannot reach the API at ${BASE_URL}. Start it with: python -m drishti api`,
    );
  }
  if (!response.ok) {
    throw new ApiError(`${path} returned ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export interface JobAccepted {
  job_id: string;
  task: string;
  queue: string;
  status_url: string;
}

export interface JobStatus {
  job_id: string;
  state: string;
  ready: boolean;
  successful: boolean | null;
  result: unknown;
  error: string | null;
}

/** Result shape of the drishti.gpu_probe task. */
export interface GpuProbe {
  worker_host: string;
  summary: string;
  usable: boolean;
  total_memory_mb: number | null;
  free_memory_mb: number | null;
}

/** POST with a JSON body. Surfaces the API's own message on a refusal. */
async function send<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = `${path} returned ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // no JSON body; the status line is the best message available
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

async function post<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { method: "POST" });
  if (!response.ok) {
    throw new ApiError(`${path} returned ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enqueue the GPU probe and poll until it finishes.
 *
 * This is the only way to learn whether CUDA is available where training will
 * actually happen: the API container ships no torch and requests no device, so
 * its own /health always reports a CPU fallback.
 */
export async function probeWorkerGpu(timeoutMs = 30_000): Promise<GpuProbe> {
  const job = await post<JobAccepted>("/api/jobs/gpu_probe");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await get<JobStatus>(`/api/jobs/${job.job_id}/status`);
    if (status.ready) {
      if (status.successful) return status.result as GpuProbe;
      throw new ApiError(status.error ?? "the probe task failed");
    }
    await sleep(700);
  }
  throw new ApiError("the worker did not respond in time — is ml-worker running?");
}

import type {
  AgencyGraph,
  Alert,
  AlertAction,
  AlertActionResult,
  AlertStats,
  CopilotAnswer,
  CopilotStatus,
  DistrictAnalytics,
  DuplicatePage,
  EarmarkReport,
  EvidenceCard,
  MPAnalytics,
  NationalAnalytics,
  Page,
  Risk,
  StateAnalytics,
  WorkSummary,
} from "./types";

export interface WorkQuery {
  [key: string]: unknown;
  band?: string;
  state?: string;
  sector?: string;
  min_risk?: number;
  actionable_only?: boolean;
  limit?: number;
  offset?: number;
}

function queryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const api = {
  baseUrl: BASE_URL,
  health: (signal?: AbortSignal) => get<Health>("/health", signal),
  probeWorkerGpu,
  listWorks: (query: WorkQuery = {}, signal?: AbortSignal) =>
    get<Page<WorkSummary>>(`/api/works${queryString(query)}`, signal),
  workRisk: (workId: number, signal?: AbortSignal) =>
    get<Risk>(`/api/works/${workId}/risk`, signal),
  evidence: (workId: number, signal?: AbortSignal) =>
    get<EvidenceCard>(`/api/works/${workId}/evidence`, signal),
  alertStats: (signal?: AbortSignal) =>
    get<AlertStats>("/api/alerts/stats", signal),
  national: (signal?: AbortSignal) =>
    get<NationalAnalytics>("/api/analytics/national", signal),
  state: (state: string, signal?: AbortSignal) =>
    get<StateAnalytics>(`/api/analytics/state/${encodeURIComponent(state)}`, signal),
  district: (districtId: number, signal?: AbortSignal) =>
    get<DistrictAnalytics>(`/api/analytics/district/${districtId}`, signal),
  mp: (mpId: number, signal?: AbortSignal) =>
    get<MPAnalytics>(`/api/analytics/mp/${mpId}`, signal),
  earmark: (signal?: AbortSignal) =>
    get<EarmarkReport>("/api/analytics/earmark?limit=25", signal),
  alerts: (query: { status?: string; limit?: number } = {}, signal?: AbortSignal) =>
    get<Page<Alert>>(`/api/alerts${queryString(query)}`, signal),
  agencyGraph: (agencyId: number, signal?: AbortSignal) =>
    get<AgencyGraph>(`/api/graph/agency/${agencyId}`, signal),
  duplicates: (limit = 25, signal?: AbortSignal) =>
    get<DuplicatePage>(`/api/duplicates?limit=${limit}`, signal),
  actionAlert: (alertId: number, action: AlertAction) =>
    send<AlertActionResult>(`/api/alerts/${alertId}/action`, action),

  // --- analyst copilot ---
  // `status` is a GET and deliberately does not probe the provider: a panel
  // that polls it must not spend free-tier quota. `python -m drishti copilot`
  // makes the live call.
  copilotStatus: (signal?: AbortSignal) =>
    get<CopilotStatus>("/api/copilot/status", signal),
  copilotAsk: (question: string) =>
    send<CopilotAnswer>("/api/copilot/query", { question }),
  copilotExplain: (workId: number) =>
    send<CopilotAnswer>(`/api/copilot/explain/${workId}`, {}),
};
