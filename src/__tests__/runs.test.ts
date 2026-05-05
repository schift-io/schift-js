import { afterEach, describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";
import { SchiftError } from "../errors.js";

/**
 * RunsClient is exposed via `client.agents.runs(agentId)`. It scopes paths
 * to `/v1/agents/{agentId}/runs`. Tests pin path/body/response remap and
 * the events replay endpoint behaviour.
 */
describe("RunsClient", () => {
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

  it("create() POSTs to /v1/agents/{id}/runs and remaps response", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: "run_1",
        agent_id: "agt_1",
        org_id: "org_1",
        status: "pending",
        input_text: "hello",
        tokens_used: 0,
        created_at: "2026-01-01",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const run = await client.agents.runs("agt_1").create({ message: "hello" });

    expect(run.id).toBe("run_1");
    expect(run.agentId).toBe("agt_1");
    expect(run.inputText).toBe("hello");
    expect(run.tokensUsed).toBe(0);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents/agt_1/runs");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      message: "hello",
    });
  });

  it("list() GETs /v1/agents/{id}/runs and remaps each entry", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse([
        {
          id: "run_1",
          agent_id: "agt_1",
          org_id: "o",
          status: "success",
          input_text: "hi",
          tokens_used: 10,
          created_at: "t",
        },
      ]),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const runs = await client.agents.runs("agt_1").list();

    expect(runs).toHaveLength(1);
    expect(runs[0]?.agentId).toBe("agt_1");
    expect(runs[0]?.tokensUsed).toBe(10);
  });

  it("get() GETs a specific run", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: "run_1",
        agent_id: "agt_1",
        org_id: "o",
        status: "success",
        input_text: "hi",
        tokens_used: 10,
        created_at: "t",
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const run = await client.agents.runs("agt_1").get("run_1");

    expect(run.id).toBe("run_1");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.schift.io/v1/agents/agt_1/runs/run_1");
  });

  it("streamEvents() yields events from the JSON-array replay endpoint with after_seq", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse([
        { seq: 1, event_type: "message", content: "hi" },
        { seq: 2, event_type: "tool_call", tool_name: "search" },
      ]),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    const events: any[] = [];
    for await (const ev of client.agents
      .runs("agt_1")
      .streamEvents("run_1", 5)) {
      events.push(ev);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ seq: 1, eventType: "message" });
    expect(events[1]).toMatchObject({ seq: 2, eventType: "tool_call" });

    const [url] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.schift.io/v1/agents/agt_1/runs/run_1/events?after_seq=5",
    );
  });

  it("maps 5xx from runs.create to SchiftError", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_x" });
    await expect(
      client.agents.runs("agt_1").create({ message: "x" }),
    ).rejects.toBeInstanceOf(SchiftError);
  });
});
