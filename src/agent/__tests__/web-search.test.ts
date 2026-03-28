import { describe, it, expect, vi } from "vitest";
import { WebSearch } from "../web-search.js";

const mockTransport = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

describe("WebSearch", () => {
  // ---- Schift Cloud (default) ----

  it("search calls /v1/web-search via transport", async () => {
    mockTransport.post.mockResolvedValueOnce({
      results: [
        { title: "Example", url: "https://example.com", snippet: "An example" },
      ],
    });
    const ws = new WebSearch({}, mockTransport as any);
    const results = await ws.search("test query");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/web-search",
      expect.objectContaining({ query: "test query", max_results: 5 }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Example");
  });

  it("uses maxResults from config", async () => {
    mockTransport.post.mockResolvedValueOnce({ results: [] });
    const ws = new WebSearch({ maxResults: 10 }, mockTransport as any);
    await ws.search("test");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/web-search",
      expect.objectContaining({ max_results: 10 }),
    );
  });

  it("defaults maxResults to 5", async () => {
    mockTransport.post.mockResolvedValueOnce({ results: [] });
    const ws = new WebSearch(undefined, mockTransport as any);
    await ws.search("default");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/web-search",
      expect.objectContaining({ max_results: 5 }),
    );
  });

  // ---- asTool ----

  it("asTool returns an AgentTool", () => {
    const ws = new WebSearch({}, mockTransport as any);
    const tool = ws.asTool();
    expect(tool.name).toBe("web_search");
    expect(tool.description).toContain("web");
    expect(tool.parameters?.properties?.query).toBeDefined();
  });

  it("asTool accepts custom name", () => {
    const ws = new WebSearch({}, mockTransport as any);
    const tool = ws.asTool("internet_search");
    expect(tool.name).toBe("internet_search");
  });

  it("asTool handler executes search", async () => {
    mockTransport.post.mockResolvedValueOnce({
      results: [
        { title: "Found", url: "https://found.com", snippet: "found it" },
      ],
    });
    const ws = new WebSearch({}, mockTransport as any);
    const tool = ws.asTool();
    const result = await tool.handler({ query: "test" });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  // ---- BYOK validation ----

  it("throws if schift provider has no transport", () => {
    expect(() => new WebSearch({ provider: "schift" })).toThrow("requires a transport");
  });

  it("throws if BYOK provider has no apiKey", () => {
    expect(() => new WebSearch({ provider: "tavily" })).toThrow("requires providerApiKey");
    expect(() => new WebSearch({ provider: "serper" })).toThrow("requires providerApiKey");
    expect(() => new WebSearch({ provider: "brave" })).toThrow("requires providerApiKey");
  });

  it("creates BYOK instance without transport", () => {
    const ws = new WebSearch({
      provider: "tavily",
      providerApiKey: "tvly-test",
    });
    expect(ws).toBeDefined();
  });

  // ---- asTool error handling ----

  it("asTool handler returns error on failure", async () => {
    mockTransport.post.mockRejectedValueOnce(new Error("API down"));
    const ws = new WebSearch({}, mockTransport as any);
    const tool = ws.asTool();
    const result = await tool.handler({ query: "test" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("API down");
  });
});
