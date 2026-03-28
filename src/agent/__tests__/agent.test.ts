import { describe, it, expect, vi } from "vitest";
import { Agent } from "../agent.js";
import { RAG } from "../rag.js";
import type { AgentTool } from "../types.js";

// Mock transport
const mockTransport = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

describe("Agent", () => {
  it("creates an agent with minimal config", () => {
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      transport: mockTransport as any,
    });
    expect(agent.name).toBe("test");
  });

  it("creates an agent with tools", () => {
    const tool: AgentTool = {
      name: "search",
      description: "Search things",
      handler: async () => ({ success: true, data: "found" }),
    };
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      tools: [tool],
      transport: mockTransport as any,
    });
    expect(agent.toolCount).toBe(1);
  });

  it("creates an agent with RAG (auto-registers tool)", () => {
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      rag,
      transport: mockTransport as any,
    });
    expect(agent.toolCount).toBe(1); // rag_search auto-registered
  });

  it("creates an agent with baseUrl (no transport needed)", () => {
    const agent = new Agent({
      name: "local",
      instructions: "Be helpful.",
      model: "llama3",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(agent.name).toBe("local");
  });

  it("throws without transport or baseUrl", () => {
    expect(() => new Agent({
      name: "broken",
      instructions: "Be helpful.",
    })).toThrow("requires either transport");
  });

  it("run delegates to runtime", async () => {
    // Mock LLM response
    mockTransport.post.mockImplementation(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{
            message: { content: "I am helpful.", tool_calls: undefined },
          }],
        };
      }
      return {};
    });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      model: "gpt-4o-mini",
      transport: mockTransport as any,
    });
    const result = await agent.run("Hello");
    expect(result.output).toBe("I am helpful.");
  });
});
