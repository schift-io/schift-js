import { afterEach, describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";
import { AuthError, EntitlementError } from "../errors.js";

/**
 * AgentsClient is exposed as `client.agents`. It uses the parent client's
 * HttpTransport. Tests pin path/body/response remap behaviour and error mapping.
 */
describe("AgentsClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("create() POSTs /v1/agents with snake_case body and remaps response to camelCase", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: "agt_1",
        org_id: "org_1",
        name: "CS Bot",
        model: "gpt-4o-mini",
        instructions: "be nice",
        tools: [],
        rag_config: { bucket_id: "bkt_1", top_k: 5 },
        metadata: {},
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const agent = await client.agents.create({
      name: "CS Bot",
      model: "gpt-4o-mini",
      instructions: "be nice",
      ragConfig: { bucketId: "bkt_1", topK: 5 },
    });

    // Response is camelCase
    expect(agent.id).toBe("agt_1");
    expect(agent.orgId).toBe("org_1");
    expect(agent.createdAt).toBe("2026-01-01T00:00:00Z");

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.name).toBe("CS Bot");
    expect(body.rag_config).toEqual({ bucketId: "bkt_1", topK: 5 });
  });

  it("list() GETs /v1/agents and remaps every entry to camelCase", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse([
        {
          id: "agt_1",
          org_id: "org_1",
          name: "A",
          model: "m",
          instructions: "i",
          tools: [],
          rag_config: {},
          metadata: {},
          created_at: "t",
          updated_at: "t",
        },
      ]),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const list = await client.agents.list();

    expect(list).toHaveLength(1);
    expect(list[0]?.orgId).toBe("org_1");

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("get() GETs /v1/agents/{id}", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: "agt_1",
        org_id: "o",
        name: "x",
        model: "m",
        instructions: "i",
        tools: [],
        rag_config: {},
        metadata: {},
        created_at: "t",
        updated_at: "t",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await client.agents.get("agt_1");

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents/agt_1");
  });

  it("update() PATCHes /v1/agents/{id} with snake_case body", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: "agt_1",
        org_id: "o",
        name: "renamed",
        model: "m",
        instructions: "i",
        tools: [],
        rag_config: {},
        metadata: {},
        created_at: "t",
        updated_at: "t",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await client.agents.update("agt_1", { name: "renamed" });

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents/agt_1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      name: "renamed",
    });
  });

  it("delete() DELETEs /v1/agents/{id}", async () => {
    const mockFetch = vi.fn(async () => new Response(null, { status: 204 }));
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await client.agents.delete("agt_1");

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents/agt_1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("maps 401 from /v1/agents to AuthError", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "no key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await expect(client.agents.list()).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 403 from /v1/agents to EntitlementError", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "upgrade plan" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await expect(
      client.agents.create({ name: "x" }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });
});
