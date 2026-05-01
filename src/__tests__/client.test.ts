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

  it("manages child collections inside a resolved bucket", async () => {
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url).replace("https://api.schift.io", "");
      if (path === "/v1/buckets") {
        return new Response(JSON.stringify([{ id: "bucket_1", name: "docs" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (path === "/v1/buckets/bucket_1/collections") {
        return new Response(JSON.stringify([{ id: "collection_1", name: "support" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: "grant_1", permission: "search" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await client.listBucketCollections("docs");
    await client.grantBucketCollectionAccess("docs", "collection_1", {
      subjectType: "role",
      subjectId: "support",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.schift.io/v1/buckets/bucket_1/collections",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.schift.io/v1/buckets/bucket_1/collections/collection_1/grants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          subject_type: "role",
          subject_id: "support",
          permission: "search",
        }),
      }),
    );
  });

  it("passes collection_id when uploading to a child collection", async () => {
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url).replace("https://api.schift.io", "");
      if (path === "/v1/buckets") {
        return new Response(JSON.stringify([{ id: "bucket_1", name: "docs" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ jobs: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await client.db.upload("docs", {
      files: [new Blob(["hello"], { type: "text/plain" })],
      collectionId: "collection_1",
    });

    const uploadCall = mockFetch.mock.calls.find(
      ([url]) => String(url) === "https://api.schift.io/v1/buckets/bucket_1/upload",
    );
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((uploadCall?.[1]?.body as FormData).get("collection_id")).toBe(
      "collection_1",
    );
  });
});
