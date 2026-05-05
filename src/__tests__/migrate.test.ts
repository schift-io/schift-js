import { afterEach, describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";
import { QuotaError } from "../errors.js";

/**
 * MigrateClient is exposed as `client.migrate`. Tests verify path/method/body
 * shape for feasibility, quote, start (POSTs) and status (GET poll).
 */
describe("MigrateClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function ok<T>(payload: T) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("feasibility() POSTs /v1/migrate/feasibility with target_model default", async () => {
    const mockFetch = vi.fn(async () =>
      ok({
        cka: 0.92,
        recommended_method: "ridge",
        holdout_cosine: 0.88,
        calibration_samples_recommended: 5000,
        notes: "good drift profile",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const resp = await client.migrate.feasibility({
      source_model: "text-embedding-3-large",
      source_vectors: [[0.1, 0.2]],
      target_vectors: [[0.3, 0.4]],
    });

    expect(resp.recommended_method).toBe("ridge");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/migrate/feasibility");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    // Default target_model="schift-embed-1" must be injected.
    expect(body.target_model).toBe("schift-embed-1");
    expect(body.source_model).toBe("text-embedding-3-large");
    expect(body.source_vectors).toEqual([[0.1, 0.2]]);
  });

  it("quote() POSTs /v1/migrate/quote with retain_on_cloud default true", async () => {
    const mockFetch = vi.fn(async () =>
      ok({
        n_total_vectors: 50_000,
        src_dim: 1536,
        retain_on_cloud: true,
        rate_per_million_cents: 10,
        quote_cents: 50,
        quote_usd: 0.5,
        free_tier: true,
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const resp = await client.migrate.quote({
      source: { kind: "pgvector", config: { dsn: "postgres://x", table: "t" } },
    });

    expect(resp.free_tier).toBe(true);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/migrate/quote");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.retain_on_cloud).toBe(true);
    expect(body.source).toEqual({
      kind: "pgvector",
      config: { dsn: "postgres://x", table: "t" },
    });
  });

  it("start() POSTs /v1/migrate/start with method=ridge default", async () => {
    const mockFetch = vi.fn(async () =>
      ok({
        job_id: "job_123",
        state: "queued",
        quote_cents: 0,
        free_tier: true,
        requires_payment: false,
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const resp = await client.migrate.start({
      source: { kind: "chroma", config: { url: "http://x" } },
      target_collection_id: "col_x",
    });

    expect(resp.job_id).toBe("job_123");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/migrate/start");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.method).toBe("ridge");
    expect(body.retain_on_cloud).toBe(true);
    expect(body.target_collection_id).toBe("col_x");
  });

  it("status() GETs /v1/migrate/{jobId}", async () => {
    const mockFetch = vi.fn(async () =>
      ok({
        job_id: "job_123",
        state: "running",
        progress: 0.42,
        n_total: 50_000,
        n_projected: 21_000,
        cka: 0.91,
        sample_retention: 0.97,
        error: null,
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const status = await client.migrate.status("job_123");

    expect(status.progress).toBeCloseTo(0.42);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/migrate/job_123");
    expect(init?.method).toBe("GET");
  });

  it("maps 402 to QuotaError on start()", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "migration credits exhausted" }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await expect(
      client.migrate.start({
        source: { kind: "pinecone", config: {} },
        target_collection_id: "col_y",
      }),
    ).rejects.toBeInstanceOf(QuotaError);
  });
});
