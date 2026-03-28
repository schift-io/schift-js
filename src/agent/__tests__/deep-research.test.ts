import { describe, it, expect, vi } from "vitest";
import { DeepResearch } from "../deep-research.js";

// Mock LLM: returns canned responses based on system prompt content
const mockLlm = vi.fn().mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
  const system = messages[0]?.content ?? "";

  // Query generation
  if (system.includes("query generator")) {
    return "search query one\nsearch query two";
  }
  // Sufficiency evaluation
  if (system.includes("sufficient")) {
    return "yes";
  }
  // Synthesis
  if (system.includes("research analyst")) {
    return "This is the synthesized report based on [1] and [2].";
  }
  return "unknown";
});

// Mock transport for Schift Cloud mode
const mockTransport = {
  post: vi.fn().mockResolvedValue({
    results: [
      { title: "Result A", url: "https://a.com", snippet: "Snippet A" },
      { title: "Result B", url: "https://b.com", snippet: "Snippet B" },
    ],
  }),
};

describe("DeepResearch", () => {
  it("runs a complete research loop and returns report", async () => {
    const dr = new DeepResearch(
      { maxIterations: 2 },
      mockLlm,
      mockTransport as any,
    );

    const report = await dr.run("test question");

    expect(report.answer).toContain("synthesized report");
    expect(report.sources.length).toBeGreaterThan(0);
    expect(report.iterations).toBe(1); // sufficient after 1st
    expect(report.totalQueries).toBe(2);
  });

  it("respects maxIterations", async () => {
    // LLM always says "no" for sufficiency
    const neverSufficientLlm = vi.fn().mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
      const system = messages[0]?.content ?? "";
      if (system.includes("query generator")) return "query a\nquery b";
      if (system.includes("sufficient")) return "no";
      if (system.includes("research analyst")) return "final report";
      return "";
    });

    const dr = new DeepResearch(
      { maxIterations: 3 },
      neverSufficientLlm,
      mockTransport as any,
    );

    const report = await dr.run("hard question");

    expect(report.iterations).toBe(3);
    expect(report.answer).toBe("final report");
  });

  it("uses custom config values", () => {
    const dr = new DeepResearch(
      {
        maxIterations: 5,
        resultsPerSearch: 10,
        queriesPerIteration: 3,
        queryModel: "gpt-4o",
        synthesisModel: "claude-sonnet-4-6",
      },
      mockLlm,
      mockTransport as any,
    );
    expect(dr).toBeDefined();
  });

  it("works with BYOK provider", () => {
    const dr = new DeepResearch(
      {
        webSearch: { provider: "tavily", providerApiKey: "tvly-test" },
      },
      mockLlm,
    );
    expect(dr).toBeDefined();
  });

  it("asTool returns an AgentTool", () => {
    const dr = new DeepResearch({}, mockLlm, mockTransport as any);
    const tool = dr.asTool();
    expect(tool.name).toBe("deep_research");
    expect(tool.description).toContain("research");
    expect(tool.parameters?.properties?.query).toBeDefined();
  });

  it("asTool accepts custom name", () => {
    const dr = new DeepResearch({}, mockLlm, mockTransport as any);
    const tool = dr.asTool("my_research");
    expect(tool.name).toBe("my_research");
  });

  it("asTool handler returns report data", async () => {
    const dr = new DeepResearch({}, mockLlm, mockTransport as any);
    const tool = dr.asTool();
    const result = await tool.handler({ query: "test" });
    expect(result.success).toBe(true);
    expect((result.data as any).answer).toContain("synthesized");
    expect((result.data as any).sources.length).toBeGreaterThan(0);
  });

  it("asTool handler returns error on failure", async () => {
    const failLlm = vi.fn().mockRejectedValue(new Error("LLM down"));
    const dr = new DeepResearch({}, failLlm, mockTransport as any);
    const tool = dr.asTool();
    const result = await tool.handler({ query: "test" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("LLM down");
  });

  it("deduplicates results by URL", async () => {
    // Transport returns same URLs every time
    const dupeTransport = {
      post: vi.fn().mockResolvedValue({
        results: [
          { title: "Same", url: "https://same.com", snippet: "Same" },
        ],
      }),
    };

    const neverSufficientLlm = vi.fn().mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
      const system = messages[0]?.content ?? "";
      if (system.includes("query generator")) return "q1\nq2";
      if (system.includes("sufficient")) return "no";
      if (system.includes("research analyst")) return "report";
      return "";
    });

    const dr = new DeepResearch(
      { maxIterations: 2 },
      neverSufficientLlm,
      dupeTransport as any,
    );

    const report = await dr.run("test");
    // 2 iterations x 2 queries x 1 result each, but all same URL = 1 unique
    expect(report.sources.length).toBe(1);
  });
});
