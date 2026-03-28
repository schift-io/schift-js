import { describe, it, expect } from "vitest";
import type { AgentConfig, AgentTool, ToolResult, RAGConfig } from "../types.js";

describe("Agent types", () => {
  it("AgentConfig has required fields", () => {
    const config: AgentConfig = {
      name: "test-agent",
      instructions: "You are a test agent.",
    };
    expect(config.name).toBe("test-agent");
    expect(config.instructions).toBe("You are a test agent.");
    expect(config.model).toBeUndefined();
    expect(config.tools).toBeUndefined();
    expect(config.maxSteps).toBeUndefined();
  });

  it("AgentTool with handler compiles", () => {
    const tool: AgentTool = {
      name: "search",
      description: "Search documents",
      handler: async () => ({ success: true, data: "result" }),
    };
    expect(tool.name).toBe("search");
  });

  it("AgentTool with parameters compiles", () => {
    const tool: AgentTool = {
      name: "search",
      description: "Search documents",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
      handler: async (args) => ({ success: true, data: args.query }),
    };
    expect(tool.parameters?.required).toEqual(["query"]);
  });

  it("ToolResult represents success", () => {
    const result: ToolResult = { success: true, data: { answer: "42" } };
    expect(result.success).toBe(true);
  });

  it("ToolResult represents failure", () => {
    const result: ToolResult = { success: false, data: null, error: "not found" };
    expect(result.success).toBe(false);
    expect(result.error).toBe("not found");
  });

  it("RAGConfig defaults", () => {
    const config: RAGConfig = { bucket: "my-docs" };
    expect(config.bucket).toBe("my-docs");
    expect(config.topK).toBeUndefined();
  });
});
