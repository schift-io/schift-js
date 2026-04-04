import { describe, it, expect, vi } from "vitest";
import { AgentRuntime } from "../runtime.js";
import { ToolRegistry } from "../tools.js";
import { ConversationMemory } from "../memory.js";
import type { AgentConfig, ChatMessage } from "../types.js";

// Mock LLM function that simulates /v1/chat/completions
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

describe("AgentRuntime", () => {
  const baseConfig: AgentConfig = {
    name: "test",
    instructions: "You are a test agent.",
    maxSteps: 5,
  };

  it("returns direct answer when LLM responds without tool calls", async () => {
    const llm = createMockLLM([{ content: "Hello, I am an agent." }]);
    const registry = new ToolRegistry();
    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("Hi");

    expect(result.output).toBe("Hello, I am an agent.");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].type).toBe("final_answer");
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("executes tool call and feeds result back to LLM", async () => {
    const llm = createMockLLM([
      // Step 1: LLM calls the echo tool
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "echo", arguments: '{"message":"hello"}' },
        }],
      },
      // Step 2: LLM gives final answer after seeing tool result
      { content: "The echo said: hello" },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echoes input",
      parameters: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
      handler: async (args) => ({ success: true, data: args.message }),
    });
    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("Say hello");

    expect(result.output).toBe("The echo said: hello");
    expect(result.steps).toHaveLength(3); // tool_call + tool_result + final_answer
    expect(result.steps[0].type).toBe("tool_call");
    expect(result.steps[0].toolName).toBe("echo");
    expect(result.steps[1].type).toBe("tool_result");
    expect(result.steps[2].type).toBe("final_answer");
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("stops at maxSteps", async () => {
    // LLM always calls a tool, never gives final answer
    const infiniteToolCalls = Array.from({ length: 10 }, () => ({
      tool_calls: [{
        id: "call_x",
        function: { name: "echo", arguments: '{"message":"loop"}' },
      }],
    }));
    const llm = createMockLLM(infiniteToolCalls);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echoes",
      handler: async (args) => ({ success: true, data: args.message }),
    });
    const memory = new ConversationMemory();
    const config = { ...baseConfig, maxSteps: 3 };
    const runtime = new AgentRuntime(config, registry, memory, llm);

    const result = await runtime.run("loop forever");

    // 3 iterations * 2 steps (tool_call + tool_result) + 1 error step
    expect(result.steps.at(-1)?.type).toBe("error");
    expect(result.output).toContain("maximum steps");
  });

  it("handles tool execution errors gracefully", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "broken", arguments: "{}" },
        }],
      },
      { content: "The tool failed, sorry." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "broken",
      description: "Always fails",
      handler: async () => { throw new Error("kaboom"); },
    });
    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("try broken tool");

    expect(result.output).toBe("The tool failed, sorry.");
    const toolResultStep = result.steps.find((s) => s.type === "tool_result");
    expect(toolResultStep?.toolResult?.success).toBe(false);
    expect(toolResultStep?.toolResult?.error).toContain("kaboom");

    const secondTurnMessages = llm.mock.calls[1]?.[0] as ChatMessage[];
    const toolMemory = secondTurnMessages.find((m) => m.role === "tool" && m.toolName === "broken");
    expect(toolMemory?.content).toContain("\"success\":false");
    expect(toolMemory?.content).toContain("\"error\"");
    expect(toolMemory?.content).toContain("kaboom");
  });

  it("handles hallucinated tool names gracefully", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [{
          id: "call_1",
          function: { name: "nonexistent_tool", arguments: "{}" },
        }],
      },
      { content: "Sorry, I tried a tool that doesn't exist." },
    ]);

    const registry = new ToolRegistry();
    const memory = new ConversationMemory();
    const runtime = new AgentRuntime(baseConfig, registry, memory, llm);

    const result = await runtime.run("do something");

    expect(result.output).toBe("Sorry, I tried a tool that doesn't exist.");
    const toolResultStep = result.steps.find((s) => s.type === "tool_result");
    expect(toolResultStep?.toolResult?.success).toBe(false);
    expect(toolResultStep?.toolResult?.error).toContain("not found");
  });
});
