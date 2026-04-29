/**
 * Migration client — vectors-in migration into the schift-embed-1 1024d hub.
 *
 * @example
 * ```ts
 * const q = await schift.migrate.quote({ source: { kind: "pgvector", config: {...} } });
 * if (q.free_tier) {
 *   const job = await schift.migrate.start({ source, target_collection_id: "col_x" });
 *   // poll
 *   const status = await schift.migrate.status(job.job_id);
 * }
 * ```
 */

import type { HttpTransport } from "../workflow/client.js";

export type ConnectorKind = "pgvector" | "chroma" | "pinecone" | "weaviate";

export interface SourceConfig {
  kind: ConnectorKind;
  config: Record<string, unknown>;
}

export interface FeasibilityRequest {
  source_model: string;
  target_model?: string; // defaults schift-embed-1
  source_vectors: number[][];
  target_vectors: number[][];
}

export interface FeasibilityResponse {
  cka: number;
  recommended_method: "procrustes" | "ridge" | "re_embed";
  holdout_cosine: number;
  calibration_samples_recommended: number;
  notes: string;
}

export interface QuoteRequest {
  source: SourceConfig;
  retain_on_cloud?: boolean;
}

export interface QuoteResponse {
  n_total_vectors: number;
  src_dim: number;
  retain_on_cloud: boolean;
  rate_per_million_cents: number;
  quote_cents: number;
  quote_usd: number;
  free_tier: boolean;
}

export interface StartRequest {
  source: SourceConfig;
  target_collection_id: string;
  method?: "ridge" | "procrustes";
  retain_on_cloud?: boolean;
}

export interface StartResponse {
  job_id: string;
  state: string;
  quote_cents: number;
  free_tier: boolean;
  requires_payment: boolean;
}

export interface JobStatus {
  job_id: string;
  state: string;
  progress: number;
  n_total: number;
  n_projected: number;
  cka: number | null;
  sample_retention: number | null;
  error: string | null;
}

const BASE = "/v1/migrate";

export class MigrateClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  /** CKA + holdout Ridge cosine; recommends method. No charge. */
  async feasibility(request: FeasibilityRequest): Promise<FeasibilityResponse> {
    return this.http.post<FeasibilityResponse>(`${BASE}/feasibility`, {
      target_model: "schift-embed-1",
      ...request,
    });
  }

  /** Size-aware quote. retain_on_cloud=true → $0.10/1M, false → $0.50/1M. */
  async quote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.http.post<QuoteResponse>(`${BASE}/quote`, {
      retain_on_cloud: true,
      ...request,
    });
  }

  /** Kick off async migration. Free tier (≤100K) auto-paid; else requires_payment=true. */
  async start(request: StartRequest): Promise<StartResponse> {
    return this.http.post<StartResponse>(`${BASE}/start`, {
      method: "ridge",
      retain_on_cloud: true,
      ...request,
    });
  }

  /** Poll a migration job. */
  async status(jobId: string): Promise<JobStatus> {
    return this.http.get<JobStatus>(`${BASE}/${jobId}`);
  }
}
