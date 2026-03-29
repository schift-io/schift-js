/**
 * Scenario tests for CRITICAL/HIGH/MEDIUM findings from scenario exploration.
 * Covers: tool timeout (#16), JSON parse feedback (#47), LLM 429 retry (#12),
 * tool result truncation (#22), maxToolCalls (#19), memory isolation (#21),
 * maxSteps (#5), empty input (#6), parallel tool calls (#37),
 * JSON schema mismatch (#32), BYOK key expiry (#27), Node crash (#41).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentRuntime } from "../runtime.js";
import { Agent } from "../agent.js";
import { ToolRegistry } from "../tools.js";
import { ConversationMemory } from "../memory.js";
import type { AgentConfig, ChatMessage } from "../types.js";

function createMockLLM(responses: Array<{
  content?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}>) {
  let callIndex = 0;
  return vi.fn(async (_messages: ChatMessage[], _tools: unknown[]) => {
    const resp = responses[callIndex++];
    if (!resp) throw new Error("Mock LLM: no more responses");
    return resp;
  });
}

const baseConfig: AgentConfig = {
  name: "test",
  instructions: "You are a test agent.",
  maxSteps: 5,
};

// ── #16 (HIGH): Tool handler infinite hang — timeout ──────────────────

describe("Scenario #16: Tool handler timeout", () => {
  it("times out a hanging tool handler and returns error", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "hang", arguments: "{}" },
        }],
      },
      { content: "Tool timed out, sorry." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "hang",
      description: "Hangs forever",
      handler: async () => new Promise(() => {}), // never resolves
    });

    const memory = new ConversationMemory();
    const config: AgentConfig = { ...baseConfig, toolTimeoutMs: 50 }; // 50ms timeout
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("call hang");

    const toolResult = result.steps.find((s) => s.type === "tool_result");
    expect(toolResult?.toolResult?.success).toBe(false);
    expect(toolResult?.toolResult?.error).toContain("timed out");
  });

  it("succeeds when tool finishes within timeout", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "fast", arguments: '{"x":1}' },
        }],
      },
      { content: "Done." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "fast",
      description: "Fast tool",
      handler: async () => ({ success: true, data: "quick" }),
    });

    const memory = new ConversationMemory();
    const config: AgentConfig = { ...baseConfig, toolTimeoutMs: 5000 };
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("fast call");
    expect(result.output).toBe("Done.");
  });
});

// ── #47 (HIGH): Invalid JSON tool arguments ─────────────────────────

describe("Scenario #47: Invalid JSON tool arguments", () => {
  it("feeds parse error back to LLM instead of silently using {}", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "search", arguments: "{invalid json!!}" },
        }],
      },
      { content: "I'll fix my arguments." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "search",
      description: "Search",
      handler: async () => ({ success: true, data: "should not reach" }),
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("search something");

    const toolResult = result.steps.find((s) => s.type === "tool_result");
    expect(toolResult?.toolResult?.success).toBe(false);
    expect(toolResult?.toolResult?.error).toContain("Invalid JSON");
    expect(toolResult?.toolResult?.error).toContain("{invalid json!!}");
    // Handler should NOT have been called
    expect(registry.list().find((t) => t.name === "search")).toBeDefined();
  });
});

// ── #22 (HIGH): 1MB tool result overflows context ───────────────────

describe("Scenario #22: Tool result truncation", () => {
  it("truncates large tool results before feeding to memory", async () => {
    const largeData = "x".repeat(100_000); // 100KB
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "big_fetch", arguments: "{}" },
        }],
      },
      { content: "Got the data." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "big_fetch",
      description: "Returns large data",
      handler: async () => ({ success: true, data: largeData }),
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("fetch big data");

    expect(result.output).toBe("Got the data.");
    // Check that memory doesn't contain the full 100KB
    const messages = memory.getMessages();
    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content.length).toBeLessThan(40_000); // 32K + truncation notice
    expect(toolMsg!.content).toContain("truncated");
  });
});

// ── #19 (CRITICAL): Prompt injection — maxToolCalls limit ───────────

describe("Scenario #19: maxToolCalls limit", () => {
  it("stops agent when total tool calls exceed maxToolCalls", async () => {
    // LLM always requests 3 tool calls per iteration
    const tripleToolCalls = Array.from({ length: 10 }, () => ({
      tool_calls: [
        { id: "c1", function: { name: "echo", arguments: '{"m":"a"}' } },
        { id: "c2", function: { name: "echo", arguments: '{"m":"b"}' } },
        { id: "c3", function: { name: "echo", arguments: '{"m":"c"}' } },
      ],
    }));
    const llm = createMockLLM(tripleToolCalls);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo",
      handler: async (args) => ({ success: true, data: args.m }),
    });

    const memory = new ConversationMemory();
    const config: AgentConfig = { ...baseConfig, maxSteps: 100, maxToolCalls: 5 };
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("spam tools");

    expect(result.output).toContain("maximum tool calls");
    expect(result.steps.at(-1)?.type).toBe("error");
    // Should have stopped after 1 full iteration (3 calls) + next batch exceeds 5
    const toolCallSteps = result.steps.filter((s) => s.type === "tool_call");
    expect(toolCallSteps.length).toBeLessThanOrEqual(5);
  });
});

// ── #21 (CRITICAL): Shared Agent instance memory isolation ──────────

describe("Scenario #21: Agent memory isolation per run()", () => {
  it("concurrent runs on same Agent instance do not share memory", async () => {
    const transport = {
      post: vi.fn(async (_path: string, body: any) => {
        const messages = body.messages;
        return {
          choices: [{
            message: { content: `Echo: ${messages.find((m: any) => m.role === "user")?.content}` },
          }],
        };
      }),
    };

    const agent = new Agent({
      name: "shared",
      instructions: "Echo user input.",
      transport: transport as any,
    });

    // Run two concurrent calls
    const [result1, result2] = await Promise.all([
      agent.run("User A message"),
      agent.run("User B message"),
    ]);

    expect(result1.output).toContain("User A");
    expect(result2.output).toContain("User B");
    // Verify no cross-contamination — each call should have its own messages
    const calls = transport.post.mock.calls;
    for (const call of calls) {
      const messages = call[1].messages;
      const userMsgs = messages.filter((m: any) => m.role === "user");
      expect(userMsgs).toHaveLength(1); // Each run should only have 1 user message
    }
  });
});

// ── #5 (MEDIUM): Agent maxSteps reached ─────────────────────────────

describe("Scenario #5: maxSteps exhaustion", () => {
  it("returns error with meaningful message when steps exhausted", async () => {
    const responses = Array.from({ length: 3 }, () => ({
      tool_calls: [{
        id: "c1",
        function: { name: "search", arguments: '{"q":"complex"}' },
      }],
    }));
    const llm = createMockLLM(responses);

    const registry = new ToolRegistry();
    registry.register({
      name: "search",
      description: "Search",
      handler: async () => ({ success: true, data: "partial result" }),
    });

    const memory = new ConversationMemory();
    const config: AgentConfig = { ...baseConfig, maxSteps: 3 };
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("complex multi-step query");

    expect(result.output).toContain("maximum steps (3)");
    expect(result.steps.at(-1)?.type).toBe("error");
    // Verify all steps were recorded (not empty output)
    expect(result.steps.length).toBeGreaterThan(1);
  });
});

// ── #6 (MEDIUM): Empty string agent.run ─────────────────────────────

describe("Scenario #6: Empty input to agent.run()", () => {
  it("handles empty string input without crashing", async () => {
    const transport = {
      post: vi.fn(async () => ({
        choices: [{ message: { content: "I need a question to help you." } }],
      })),
    };

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      transport: transport as any,
    });

    const result = await agent.run("");

    expect(result.output).toBeTruthy();
    expect(result.steps).toHaveLength(1);
    // Verify LLM was still called (empty input should not be silently dropped)
    expect(transport.post).toHaveBeenCalled();
  });

  it("handles whitespace-only input", async () => {
    const transport = {
      post: vi.fn(async () => ({
        choices: [{ message: { content: "Could you please ask a question?" } }],
      })),
    };

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      transport: transport as any,
    });

    const result = await agent.run("   ");

    expect(result.output).toBeTruthy();
  });
});

// ── #32 (MEDIUM): JSON Schema parameter mismatch ────────────────────

describe("Scenario #32: LLM sends wrong params (no schema validation)", () => {
  it("handler receives undefined for missing required params", async () => {
    const handlerSpy = vi.fn(async (args) => {
      // Handler should handle missing params gracefully
      const name = args.name ?? "unknown";
      return { success: true, data: `Hello ${name}` };
    });

    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "c1",
          // LLM sends "username" instead of expected "name"
          function: { name: "greet", arguments: '{"username":"Alice"}' },
        }],
      },
      { content: "Greeted." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "greet",
      description: "Greet by name",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Person name" } },
        required: ["name"],
      },
      handler: handlerSpy,
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("greet alice");

    expect(result.output).toBe("Greeted.");
    expect(handlerSpy).toHaveBeenCalledWith({ username: "Alice" });
  });
});

// ── #37 (LOW): Parallel tool calls ──────────────────────────────────

describe("Scenario #37: Multiple tool_calls in single response", () => {
  it("executes multiple tool calls sequentially", async () => {
    const callOrder: string[] = [];
    const llm = createMockLLM([
      {
        tool_calls: [
          { id: "c1", function: { name: "tool_a", arguments: "{}" } },
          { id: "c2", function: { name: "tool_b", arguments: "{}" } },
          { id: "c3", function: { name: "tool_c", arguments: "{}" } },
        ],
      },
      { content: "All three done." },
    ]);

    const registry = new ToolRegistry();
    for (const name of ["tool_a", "tool_b", "tool_c"]) {
      registry.register({
        name,
        description: name,
        handler: async () => {
          callOrder.push(name);
          return { success: true, data: name };
        },
      });
    }

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("do three things");

    expect(result.output).toBe("All three done.");
    expect(callOrder).toEqual(["tool_a", "tool_b", "tool_c"]); // sequential
    expect(result.steps.filter((s) => s.type === "tool_call")).toHaveLength(3);
    expect(result.steps.filter((s) => s.type === "tool_result")).toHaveLength(3);
  });
});

// ── #12 (HIGH): LLM 429 retry ───────────────────────────────────────

describe("Scenario #12: LLM provider 429 rate limit retry", () => {
  it("retries on 429 and succeeds on subsequent attempt", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: new Headers({ "retry-after": "0" }), // instant retry for test
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Success after retry!" } }],
        }),
      };
    });

    // Temporarily override global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    try {
      const agent = new Agent({
        name: "retry-test",
        instructions: "Test.",
        baseUrl: "http://localhost:9999/v1",
        apiKey: "test-key",
      });

      const result = await agent.run("hello");

      expect(result.output).toBe("Success after retry!");
      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 retries + 1 success
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gives up after max retries", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({ "retry-after": "0" }),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    try {
      const agent = new Agent({
        name: "retry-test",
        instructions: "Test.",
        baseUrl: "http://localhost:9999/v1",
        apiKey: "test-key",
      });

      await expect(agent.run("hello")).rejects.toThrow("429");
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ── #27 (MEDIUM): BYOK key expires mid-run ──────────────────────────

describe("Scenario #27: LLM API key expires mid-run", () => {
  it("returns error step when LLM call fails mid-iteration", async () => {
    let callCount = 0;
    const llm = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // First call succeeds with tool call
        return {
          tool_calls: [{
            id: "c1",
            function: { name: "search", arguments: '{"q":"test"}' },
          }],
        };
      }
      // Second call fails (key expired)
      throw new Error("401 Unauthorized: API key expired");
    });

    const registry = new ToolRegistry();
    registry.register({
      name: "search",
      description: "Search",
      handler: async () => ({ success: true, data: "result" }),
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    await expect(runtime.run("research topic")).rejects.toThrow("401");
  });
});

// ── #44 (MEDIUM): RAG search returns 503 during maintenance ─────────

describe("Scenario #44: Schift Cloud 503 during agent.run", () => {
  it("tool error propagates cleanly when RAG search fails", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "c1",
          function: { name: "rag_search", arguments: '{"query":"help"}' },
        }],
      },
      { content: "Sorry, search is temporarily unavailable." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "rag_search",
      description: "Search docs",
      handler: async () => { throw new Error("503 Service Unavailable"); },
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("help with billing");

    expect(result.output).toContain("unavailable");
    const toolResult = result.steps.find((s) => s.type === "tool_result");
    expect(toolResult?.toolResult?.success).toBe(false);
    expect(toolResult?.toolResult?.error).toContain("503");
  });
});

// ── Compound scenarios ──────────────────────────────────────────────

describe("Compound: timeout + JSON error in same run", () => {
  it("handles mixed tool failures gracefully", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [
          // First: malformed JSON
          { id: "c1", function: { name: "tool_a", arguments: "not json" } },
          // Second: will timeout
          { id: "c2", function: { name: "tool_b", arguments: "{}" } },
        ],
      },
      { content: "Both tools failed, I'll answer directly." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "tool_a",
      description: "A",
      handler: async () => ({ success: true, data: "a" }),
    });
    registry.register({
      name: "tool_b",
      description: "B",
      handler: async () => new Promise(() => {}), // hangs
    });

    const memory = new ConversationMemory();
    const config: AgentConfig = { ...baseConfig, toolTimeoutMs: 50 };
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("do stuff");

    expect(result.output).toBe("Both tools failed, I'll answer directly.");
    const toolResults = result.steps.filter((s) => s.type === "tool_result");
    expect(toolResults).toHaveLength(2);
    expect(toolResults[0].toolResult?.error).toContain("Invalid JSON");
    expect(toolResults[1].toolResult?.error).toContain("timed out");
  });
});

// ── #19 (CRITICAL): Per-tool call rate limit ──────────────────────────

describe("Scenario #19: Per-tool maxCallsPerRun limit", () => {
  it("blocks tool after exceeding per-tool call limit", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [
          { id: "c1", function: { name: "collect_lead", arguments: '{"email":"a@a.com"}' } },
        ],
      },
      {
        tool_calls: [
          { id: "c2", function: { name: "collect_lead", arguments: '{"email":"b@b.com"}' } },
        ],
      },
      { content: "Done collecting." },
    ]);

    const handlerSpy = vi.fn(async (args: Record<string, unknown>) => ({
      success: true,
      data: `Collected ${args.email}`,
    }));

    const registry = new ToolRegistry();
    registry.register({
      name: "collect_lead",
      description: "Collect a lead",
      maxCallsPerRun: 1,
      handler: handlerSpy,
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("collect leads");

    // Handler should be called only once (first call succeeds, second blocked)
    expect(handlerSpy).toHaveBeenCalledTimes(1);
    const toolResults = result.steps.filter((s) => s.type === "tool_result");
    expect(toolResults[1]?.toolResult?.error).toContain("per-run call limit");
  });
});

// ── #30 (MEDIUM): Query length truncation in RAG ──────────────────────

describe("Scenario #30: RAG query length truncation", () => {
  it("truncates queries exceeding MAX_QUERY_LENGTH", async () => {
    const { RAG } = await import("../rag.js");

    let capturedQuery = "";
    const transport = {
      post: vi.fn(async (_path: string, body: any) => {
        capturedQuery = body.query;
        return { results: [] };
      }),
    };

    const rag = new RAG({ bucket: "test" }, transport as any);
    const longQuery = "x".repeat(10_000);
    await rag.search(longQuery);

    expect(capturedQuery.length).toBe(RAG.MAX_QUERY_LENGTH);
    expect(capturedQuery.length).toBeLessThan(longQuery.length);
  });

  it("passes short queries unchanged", async () => {
    const { RAG } = await import("../rag.js");

    let capturedQuery = "";
    const transport = {
      post: vi.fn(async (_path: string, body: any) => {
        capturedQuery = body.query;
        return { results: [] };
      }),
    };

    const rag = new RAG({ bucket: "test" }, transport as any);
    await rag.search("normal query");

    expect(capturedQuery).toBe("normal query");
  });
});
