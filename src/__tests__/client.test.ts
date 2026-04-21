import { afterEach, describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";

describe("Schift client search", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses bucket in the bucket search endpoint", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ results: [{ id: "doc_1", score: 0.9 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const results = await client.search({ bucket: "docs", query: "hello", topK: 3 });

    expect(results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.schift.io/v1/buckets/docs/search",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"top_k":3'),
      }),
    );
  });

  it("keeps collection as a deprecated search alias", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await client.search({ collection: "legacy-docs", query: "hello" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.schift.io/v1/buckets/legacy-docs/search",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
