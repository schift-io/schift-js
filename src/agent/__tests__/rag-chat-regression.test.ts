import { describe, expect, it, vi } from "vitest";
import { RAG } from "../rag.js";

describe("RAG chat request body", () => {
  it("uses the canonical message field for /v1/chat", async () => {
    const transport = {
      post: vi.fn().mockResolvedValue({ answer: "ok", sources: [] }),
    };
    const rag = new RAG({ bucket: "docs", topK: 3 }, transport as any);

    await rag.chat("hello");

    expect(transport.post).toHaveBeenCalledWith("/v1/chat", {
      message: "hello",
      bucket_id: "docs",
      top_k: 3,
    });
    expect(transport.post.mock.calls[0]![1].query).toBeUndefined();
  });
});
