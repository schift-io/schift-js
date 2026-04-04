import { describe, expect, it, vi } from "vitest";
import { AgentRuntime } from "../runtime.js";
import { ToolRegistry } from "../tools.js";
import { ConversationMemory } from "../memory.js";
import type { AgentConfig, ChatMessage } from "../types.js";
import { AgentEventEmitter } from "../events.js";
import { PolicyEngine } from "../policy.js";

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

describe("AgentRuntime events/parallel/abort", () => {
  const baseConfig: AgentConfig = {
    name: "test",
    instructions: "You are a test agent.",
    maxSteps: 5,
  };

  it("emits lifecycle events", async () => {
    const llm = createMockLLM([{ content: "done" }]);
    const registry = new ToolRegistry();
    const memory = new ConversationMemory();
    const emitter = new AgentEventEmitter();

    const events: string[] = [];
    emitter.on("*", (e) => events.push(e.type));

    const runtime = new AgentRuntime(baseConfig, registry, memory, llm, { emitter, runId: "run_1" });
    const result = await runtime.run("hello");

    expect(result.output).toBe("done");
    expect(events).toContain("agent_start");
    expect(events).toContain("turn_start");
    expect(events).toContain("message_delta");
    expect(events).toContain("agent_end");
  });

  it("executes multiple tool calls in parallel mode", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [
          { id: "c1", function: { name: "slow", arguments: "{}" } },
          { id: "c2", function: { name: "fast", arguments: "{}" } },
        ],
      },
      { content: "ok" },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "slow",
      description: "slow",
      handler: async () => {
        await new Promise((r) => setTimeout(r, 30));
        return { success: true, data: "slow" };
      },
    });
    registry.register({
      name: "fast",
      description: "fast",
      handler: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { success: true, data: "fast" };
      },
    });

    const memory = new ConversationMemory();
    const runtime = new AgentRuntime({ ...baseConfig, parallelToolExecution: true }, registry, memory, llm);
    const result = await runtime.run("go");

    expect(result.output).toBe("ok");
    const toolCallSteps = result.steps.filter((s) => s.type === "tool_call");
    expect(toolCallSteps).toHaveLength(2);
  });

  it("aborts before iteration when signal is aborted", async () => {
    const llm = createMockLLM([{ content: "should-not-run" }]);
    const registry = new ToolRegistry();
    const memory = new ConversationMemory();
    const ac = new AbortController();
    ac.abort();

    const runtime = new AgentRuntime(baseConfig, registry, memory, llm, { signal: ac.signal });
    const result = await runtime.run("hello");

    expect(result.output).toContain("aborted");
    expect(llm).toHaveBeenCalledTimes(0);
  });

  it("blocks only violating call and runs allowed calls in parallel", async () => {
    const llm = createMockLLM([
      {
        tool_calls: [
          { id: "c1", function: { name: "blocked_tool", arguments: "{}" } },
          { id: "c2", function: { name: "allowed_tool_1", arguments: "{}" } },
          { id: "c3", function: { name: "allowed_tool_2", arguments: "{}" } },
        ],
      },
      { content: "ok" },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "blocked_tool",
      description: "blocked",
      handler: async () => ({ success: true, data: "should-not-run" }),
    });
    registry.register({
      name: "allowed_tool_1",
      description: "allowed1",
      handler: async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { success: true, data: "a1" };
      },
    });
    registry.register({
      name: "allowed_tool_2",
      description: "allowed2",
      handler: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { success: true, data: "a2" };
      },
    });

    const memory = new ConversationMemory();
    const emitter = new AgentEventEmitter();
    const policyEvents: Array<{ toolName?: string; reason: string }> = [];
    emitter.on("policy_violation", (event) => {
      policyEvents.push({ toolName: event.toolName, reason: event.reason });
    });

    const runtime = new AgentRuntime(
      { ...baseConfig, parallelToolExecution: true },
      registry,
      memory,
      llm,
      {
        emitter,
        runId: "run_policy_parallel",
        skillName: "customer-support",
        policyEngine: new PolicyEngine({
          skillName: "customer-support",
          blockedTools: ["blocked_tool"],
        }),
      },
    );

    const result = await runtime.run("go");
    expect(result.output).toBe("ok");

    const toolResultSteps = result.steps.filter((s) => s.type === "tool_result");
    expect(toolResultSteps).toHaveLength(3);

    const blockedResult = toolResultSteps.find((s) => s.toolName === "blocked_tool");
    expect(blockedResult?.toolResult?.success).toBe(false);
    expect(blockedResult?.toolResult?.error).toContain("POLICY_VIOLATION");

    const allowed1 = toolResultSteps.find((s) => s.toolName === "allowed_tool_1");
    const allowed2 = toolResultSteps.find((s) => s.toolName === "allowed_tool_2");
    expect(allowed1?.toolResult?.success).toBe(true);
    expect(allowed2?.toolResult?.success).toBe(true);

    expect(policyEvents).toHaveLength(1);
    expect(policyEvents[0]?.toolName).toBe("blocked_tool");
    expect(policyEvents[0]?.reason).toContain("blocked");

    const secondTurnMessages = llm.mock.calls[1]?.[0] as ChatMessage[];
    const blockedToolMemory = secondTurnMessages.find(
      (m) => m.role === "tool" && m.toolName === "blocked_tool",
    );
    expect(blockedToolMemory?.content).toContain("POLICY_VIOLATION");
    expect(blockedToolMemory?.content).toContain("\"error\"");
  });
});
