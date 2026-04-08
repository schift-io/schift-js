import type { AgentConfig, AgentStep, AgentRunResult, ChatMessage } from "./types.js";
import type { ToolRegistry } from "./tools.js";
import type { ConversationMemory } from "./memory.js";
import type { AgentEventEmitter } from "./events.js";
import type { PolicyEngine } from "./policy.js";
import { policyViolation } from "./policy.js";

/** LLM call function signature. Matches Schift /v1/chat/completions response shape. */
export type LLMCallFn = (
  messages: ChatMessage[],
  tools: unknown[],
) => Promise<{
  content?: string;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
}>;

/**
 * AgentRuntime -- the ReAct loop engine.
 *
 * Loop: build messages -> call LLM -> if tool_call, execute and loop -> if content, return.
 * Stops when LLM returns content without tool_calls, or maxSteps is reached.
 */
export class AgentRuntime {
  private readonly config: AgentConfig;
  private readonly tools: ToolRegistry;
  private readonly memory: ConversationMemory;
  private readonly llm: LLMCallFn;
  private readonly maxSteps: number;
  private readonly toolTimeoutMs: number;
  private readonly emitter?: AgentEventEmitter;
  private readonly signal?: AbortSignal;
  private readonly parallelToolExecution: boolean;
  private readonly runId: string;
  private readonly policyEngine?: PolicyEngine;
  private readonly skillName?: string;

  constructor(
    config: AgentConfig,
    tools: ToolRegistry,
    memory: ConversationMemory,
    llm: LLMCallFn,
    options?: {
      emitter?: AgentEventEmitter;
      signal?: AbortSignal;
      runId?: string;
      policyEngine?: PolicyEngine;
      skillName?: string;
    },
  ) {
    this.config = config;
    this.tools = tools;
    this.memory = memory;
    this.llm = llm;
    this.maxSteps = config.maxSteps ?? 10;
    this.toolTimeoutMs = config.toolTimeoutMs ?? 30_000;
    this.emitter = options?.emitter;
    this.signal = options?.signal;
    this.parallelToolExecution = config.parallelToolExecution ?? false;
    this.runId = options?.runId ?? crypto.randomUUID();
    this.policyEngine = options?.policyEngine;
    this.skillName = options?.skillName;
  }

  async run(input: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let stepCounter = 0;
    let totalToolCalls = 0;
    const maxToolCalls = this.config.maxToolCalls ?? this.maxSteps * 5;
    const perToolCounts = new Map<string, number>();

    this.emitter?.emit({ type: "agent_start", runId: this.runId, timestamp: Date.now(), input });

    // Seed memory with system + user message
    this.memory.add({ role: "system", content: this.config.instructions });
    this.memory.add({ role: "user", content: input });

    const toolDefs = this.tools.toOpenAI();
    let terminalError: string | null = null;

    for (let iteration = 0; iteration < this.maxSteps; iteration++) {
      if (this.signal?.aborted) {
        const errorMsg = "Agent run aborted";
        steps.push({ id: `step_${stepCounter++}`, type: "error", content: errorMsg, durationMs: 0 });
        this.emitter?.emit({ type: "error", runId: this.runId, timestamp: Date.now(), error: new Error(errorMsg) });
        return { steps, output: errorMsg, totalDurationMs: Date.now() - startTime };
      }

      this.emitter?.emit({ type: "turn_start", runId: this.runId, timestamp: Date.now(), turnIndex: iteration });

      const messages = this.memory.getMessages();
      const stepStart = Date.now();

      const response = await this.llm(messages, toolDefs);

      // Case 1: LLM returns a final answer (no tool calls)
      if (!response.tool_calls?.length) {
        const answer = response.content ?? "";
        steps.push({
          id: `step_${stepCounter++}`,
          type: "final_answer",
          content: answer,
          durationMs: Date.now() - stepStart,
        });
        this.memory.add({ role: "assistant", content: answer });
        this.emitter?.emit({ type: "message_delta", runId: this.runId, timestamp: Date.now(), content: answer });
        this.emitter?.emit({
          type: "agent_end",
          runId: this.runId,
          timestamp: Date.now(),
          output: answer,
          totalDurationMs: Date.now() - startTime,
        });
        return { steps, output: answer, totalDurationMs: Date.now() - startTime };
      }

      // Case 2: LLM wants to call tools
      if (totalToolCalls + response.tool_calls.length > maxToolCalls) {
        const errorMsg = `Agent exceeded maximum tool calls (${maxToolCalls})`;
        steps.push({ id: `step_${stepCounter++}`, type: "error", content: errorMsg, durationMs: 0 });
        this.emitter?.emit({ type: "error", runId: this.runId, timestamp: Date.now(), error: new Error(errorMsg) });
        return { steps, output: errorMsg, totalDurationMs: Date.now() - startTime };
      }

      const executeToolCall = async (toolCall: {
        id: string;
        function: { name: string; arguments: string };
      }) => {
        totalToolCalls++;
        const { name, arguments: argsStr } = toolCall.function;

        const toolCount = (perToolCounts.get(name) ?? 0) + 1;
        perToolCounts.set(name, toolCount);
        const toolDef = this.tools.get(name);
        if (toolDef?.maxCallsPerRun && toolCount > toolDef.maxCallsPerRun) {
          const limitMsg = `Tool "${name}" exceeded per-run call limit (${toolDef.maxCallsPerRun})`;
          const result = { success: false, data: null, error: limitMsg };
          this.memory.add({ role: "tool", content: limitMsg, toolCallId: toolCall.id, toolName: name });
          this.emitter?.emit({
            type: "tool_result",
            runId: this.runId,
            timestamp: Date.now(),
            toolName: name,
            callId: toolCall.id,
            result,
            durationMs: 0,
          });
          terminalError = limitMsg;
          return { toolCall, name, args: {}, argsStr, result, execDuration: 0 };
        }

        let args: Record<string, unknown>;
        let parseError: string | null = null;
        try {
          args = JSON.parse(argsStr);
        } catch (e) {
          args = {};
          parseError = `Invalid JSON in tool arguments: ${e instanceof Error ? e.message : String(e)}. Raw: ${argsStr.slice(0, 200)}`;
        }

        this.emitter?.emit({
          type: "tool_call",
          runId: this.runId,
          timestamp: Date.now(),
          toolName: name,
          toolArgs: args,
          callId: toolCall.id,
        });

        const beforeDecision = this.policyEngine?.beforeTool({ toolName: name, args });
        if (beforeDecision && !beforeDecision.allowed) {
          const blocked = policyViolation(beforeDecision.reason ?? "blocked");
          this.emitter?.emit({
            type: "policy_violation",
            runId: this.runId,
            timestamp: Date.now(),
            skillName: this.skillName ?? "unknown",
            stage: beforeDecision.stage,
            reason: beforeDecision.reason ?? "blocked",
            toolName: name,
          });
          this.emitter?.emit({
            type: "tool_result",
            runId: this.runId,
            timestamp: Date.now(),
            toolName: name,
            callId: toolCall.id,
            result: blocked,
            durationMs: 0,
          });
          return { toolCall, name, args, argsStr, result: blocked, execDuration: 0 };
        }

        const execStart = Date.now();
        let result;
        if (parseError) {
          result = { success: false, data: null, error: parseError };
        } else if (this.signal?.aborted) {
          result = { success: false, data: null, error: "Agent run aborted" };
        } else {
          try {
            result = await Promise.race([
              this.tools.execute(name, args),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${this.toolTimeoutMs}ms`)), this.toolTimeoutMs),
              ),
            ]);
          } catch (err) {
            result = {
              success: false,
              data: null,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }

        const afterDecision = this.policyEngine?.afterTool({ toolName: name, result });
        if (afterDecision && !afterDecision.allowed) {
          result = policyViolation(afterDecision.reason ?? "blocked");
          this.emitter?.emit({
            type: "policy_violation",
            runId: this.runId,
            timestamp: Date.now(),
            skillName: this.skillName ?? "unknown",
            stage: afterDecision.stage,
            reason: afterDecision.reason ?? "blocked",
            toolName: name,
          });
        }

        const execDuration = Date.now() - execStart;
        this.emitter?.emit({
          type: "tool_result",
          runId: this.runId,
          timestamp: Date.now(),
          toolName: name,
          callId: toolCall.id,
          result,
          durationMs: execDuration,
        });

        return { toolCall, name, args, argsStr, result, execDuration };
      };

      const toolCalls = response.tool_calls ?? [];
      const executed = this.parallelToolExecution
        ? await Promise.all(toolCalls.map((tc) => executeToolCall(tc)))
        : await (async () => {
            const out: Awaited<ReturnType<typeof executeToolCall>>[] = [];
            for (const tc of toolCalls) {
              out.push(await executeToolCall(tc));
            }
            return out;
          })();

      for (const item of executed) {
        steps.push({
          id: `step_${stepCounter++}`,
          type: "tool_call",
          toolName: item.name,
          toolArgs: item.args,
          durationMs: item.execDuration,
        });

        steps.push({
          id: `step_${stepCounter++}`,
          type: "tool_result",
          toolName: item.name,
          toolResult: item.result,
          durationMs: 0,
        });

        this.memory.add({
          role: "assistant",
          content: `[Tool call: ${item.name}(${item.argsStr})]`,
        });
        const maxResultBytes = 32_000;
        const memoryPayload = item.result.success ? item.result.data : item.result;
        let resultStr = JSON.stringify(memoryPayload);
        if (resultStr === undefined) {
          resultStr = "null";
        }
        if (resultStr.length > maxResultBytes) {
          resultStr = resultStr.slice(0, maxResultBytes) + `\n...[truncated from ${resultStr.length} to ${maxResultBytes} chars]`;
        }
        this.memory.add({
          role: "tool",
          content: resultStr,
          toolCallId: item.toolCall.id,
          toolName: item.name,
        });
      }

      if (terminalError) {
        steps.push({
          id: `step_${stepCounter++}`,
          type: "error",
          content: terminalError,
          durationMs: 0,
        });
        return { steps, output: terminalError, totalDurationMs: Date.now() - startTime };
      }
    }

    // Max steps reached without final answer
    const errorMsg = `Agent exceeded maximum steps (${this.maxSteps})`;
    steps.push({
      id: `step_${stepCounter++}`,
      type: "error",
      content: errorMsg,
      durationMs: 0,
    });
    this.emitter?.emit({ type: "error", runId: this.runId, timestamp: Date.now(), error: new Error(errorMsg) });
    return { steps, output: errorMsg, totalDurationMs: Date.now() - startTime };
  }
}
