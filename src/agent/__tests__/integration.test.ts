import { describe, it, expect, vi } from "vitest";
import { Agent, RAG } from "../index.js";

describe("Agent E2E (mocked transport)", () => {
  it("RAG agent: search docs then answer", async () => {
    const transport = {
      post: vi.fn(async (path: string, body: any) => {
        if (path.includes("/search")) {
          return {
            results: [
              { text: "Refunds are available within 30 days.", score: 0.95, metadata: {} },
            ],
          };
        }
        if (path === "/v1/chat/completions") {
          const messages = body.messages;
          const lastMsg = messages[messages.length - 1];
          // First call: LLM decides to search
          if (!lastMsg.tool_call_id) {
            return {
              choices: [{
                message: {
                  tool_calls: [{
                    id: "c1",
                    function: {
                      name: "rag_search",
                      arguments: '{"query":"refund policy"}',
                    },
                  }],
                },
              }],
            };
          }
          // Second call: LLM answers with search results
          return {
            choices: [{
              message: {
                content: "Based on our docs, refunds are available within 30 days of purchase.",
              },
            }],
          };
        }
        return {};
      }),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const rag = new RAG({ bucket: "support-docs" }, transport as any);
    const agent = new Agent({
      name: "Support Bot",
      instructions: "Answer support questions using the docs.",
      rag,
      model: "gpt-4o-mini",
      transport: transport as any,
    });

    const result = await agent.run("What is the refund policy?");

    expect(result.output).toContain("30 days");
    expect(result.steps.some((s) => s.type === "tool_call" && s.toolName === "rag_search")).toBe(true);
    expect(result.steps.at(-1)?.type).toBe("final_answer");
  });
});
