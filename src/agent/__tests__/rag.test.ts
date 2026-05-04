import { describe, it, expect, vi } from "vitest";
import { RAG } from "../rag.js";

// Mock transport — simulates Schift API calls
const mockTransport = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

describe("RAG", () => {
  it("creates a RAG instance with bucket", () => {
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    expect(rag.bucket).toBe("docs");
  });

  it("search calls /v1/buckets/{id}/search", async () => {
    mockTransport.post.mockResolvedValueOnce({
      results: [{ text: "hello", score: 0.95, metadata: {} }],
    });
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const results = await rag.search("hello");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/buckets/docs/search",
      expect.objectContaining({ query: "hello" }),
    );
    expect(results).toHaveLength(1);
  });

  it("search uses topK from config", async () => {
    mockTransport.post.mockResolvedValueOnce({ results: [] });
    const rag = new RAG({ bucket: "docs", topK: 3 }, mockTransport as any);
    await rag.search("test");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/buckets/docs/search",
      expect.objectContaining({ top_k: 3 }),
    );
  });

  it("chat calls /v1/chat with bucket context", async () => {
    mockTransport.post.mockResolvedValueOnce({
      answer: "The answer is 42",
      sources: [],
    });
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const result = await rag.chat("what is the meaning?");
    expect(mockTransport.post).toHaveBeenCalledWith(
      "/v1/chat",
      expect.objectContaining({ message: "what is the meaning?", bucket_id: "docs" }),
    );
    expect(result.answer).toBe("The answer is 42");
  });

  it("asTool returns an AgentTool for search", () => {
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const tool = rag.asTool();
    expect(tool.name).toBe("rag_search");
    expect(tool.description).toContain("search");
    expect(tool.parameters?.properties?.query).toBeDefined();
  });

  it("asTool handler executes search", async () => {
    mockTransport.post.mockResolvedValueOnce({
      results: [{ text: "found it", score: 0.9, metadata: {} }],
    });
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const tool = rag.asTool();
    const result = await tool.handler({ query: "test" });
    expect(result.success).toBe(true);
  });
});
