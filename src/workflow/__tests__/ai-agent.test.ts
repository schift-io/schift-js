import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AIAgentNode } from "../nodes/ai-agent.js";
import type { SDKExecutionContext } from "../nodes/base.js";

const ctx: SDKExecutionContext = {
  runId: "test-run",
  variables: {},
  getVar: () => undefined,
  setVar: () => undefined,
};

function makeNode(config: Record<string, unknown> = {}): AIAgentNode {
  return new AIAgentNode({ id: "agent-1", type: "ai_agent", config });
}

function mockFetchOk(content: string, totalTokens = 42) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { total_tokens: totalTokens },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

describe("AIAgentNode", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calls LLM with system prompt + user prompt and returns answer", async () => {
    const fetchMock = mockFetchOk("hello world");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const node = makeNode({ systemPrompt: "be concise" });
    const out = await node.execute(
      {
        prompt: "say hi",
        agent_languageModel: {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "sk-test",
        },
      },
      ctx,
    );

    expect(out.answer).toBe("hello world");
    expect(out.text).toBe("hello world");
    expect(out.out).toBe("hello world");
    expect(out.tokensUsed).toBe(42);
    expect(out.finishReason).toBe("final");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0]).toEqual({ role: "system", content: "be concise" });
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "say hi" });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("renders tool catalog into system prompt", async () => {
    const fetchMock = mockFetchOk("ok");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const node = makeNode();
    await node.execute(
      {
        prompt: "go",
        agent_languageModel: { provider: "openai", apiKey: "sk-test" },
        agent_tool: [
          { name: "search", description: "web search" },
          { name: "calc" },
        ],
      },
      ctx,
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    const sys = body.messages[0].content as string;
    expect(sys).toContain("Available tools");
    expect(sys).toContain("1. search — web search");
    expect(sys).toContain("2. calc");
  });

  it("includes prior memory messages between system and user", async () => {
    const fetchMock = mockFetchOk("ok");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const node = makeNode();
    await node.execute(
      {
        prompt: "current",
        agent_languageModel: { provider: "openai", apiKey: "sk-test" },
        agent_memory: {
          messages: [
            { role: "user", content: "earlier" },
            { role: "assistant", content: "earlier-reply" },
          ],
        },
      },
      ctx,
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(body.messages.at(-1).content).toBe("current");
  });

  it("throws when prompt missing and onError=fail (default)", async () => {
    const node = makeNode();
    await expect(
      node.execute(
        { agent_languageModel: { provider: "openai", apiKey: "sk-test" } },
        ctx,
      ),
    ).rejects.toThrow(/prompt/i);
  });

  it("returns soft failure when onError=empty", async () => {
    const node = makeNode({ onError: "empty" });
    const out = await node.execute(
      { agent_languageModel: { provider: "openai", apiKey: "sk-test" } },
      ctx,
    );
    expect(out.answer).toBe("");
    expect(out.finishReason).toBe("error");
    expect(out.error).toMatch(/prompt/i);
  });

  it("requires agent_languageModel sidecar (no env fallback)", async () => {
    const savedGoogle = process.env.GOOGLE_API_KEY;
    const savedOllamaBase = process.env.OLLAMA_BASE_URL;
    const savedOllamaHost = process.env.OLLAMA_HOST;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_HOST;
    try {
      const node = makeNode({ onError: "empty" });
      const out = await node.execute({ prompt: "hi" }, ctx);
      expect(out.finishReason).toBe("error");
      expect(out.error).toMatch(/agent_languageModel/);
    } finally {
      if (savedGoogle !== undefined) process.env.GOOGLE_API_KEY = savedGoogle;
      if (savedOllamaBase !== undefined) process.env.OLLAMA_BASE_URL = savedOllamaBase;
      if (savedOllamaHost !== undefined) process.env.OLLAMA_HOST = savedOllamaHost;
    }
  });

  it("falls back to Google gemini-2.5-flash-lite when GOOGLE_API_KEY env set and no LM sidecar", async () => {
    const fetchMock = mockFetchOk("hi", 5);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    const saved = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = "env-google-key";
    try {
      const node = makeNode();
      const out = await node.execute({ prompt: "hi" }, ctx);
      expect(out.answer).toBe("hi");
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("generativelanguage.googleapis.com");
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe("gemini-2.5-flash-lite");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer env-google-key",
      );
    } finally {
      if (saved !== undefined) process.env.GOOGLE_API_KEY = saved;
      else delete process.env.GOOGLE_API_KEY;
    }
  });

  it("accepts a single tool object (not just array)", async () => {
    const fetchMock = mockFetchOk("ok");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const node = makeNode();
    await node.execute(
      {
        prompt: "go",
        agent_languageModel: { provider: "openai", apiKey: "sk-test" },
        agent_tool: { name: "lone-tool" },
      },
      ctx,
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.messages[0].content).toContain("1. lone-tool");
  });

  it("surfaces HTTP errors via onError=fail", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("boom", { status: 500 }),
    ) as unknown as typeof globalThis.fetch;

    const node = makeNode();
    await expect(
      node.execute(
        {
          prompt: "go",
          agent_languageModel: { provider: "openai", apiKey: "sk-test" },
        },
        ctx,
      ),
    ).rejects.toThrow(/HTTP 500/);
  });
});
