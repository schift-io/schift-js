import type { AgentConfig, AgentStep, AgentRunResult, ChatMessage } from "./types.js";
import type { ToolRegistry } from "./tools.js";
import type { ConversationMemory } from "./memory.js";

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

  constructor(
    config: AgentConfig,
    tools: ToolRegistry,
    memory: ConversationMemory,
    llm: LLMCallFn,
  ) {
    this.config = config;
    this.tools = tools;
    this.memory = memory;
    this.llm = llm;
    this.maxSteps = config.maxSteps ?? 10;
    this.toolTimeoutMs = config.toolTimeoutMs ?? 30_000;
  }

  async run(input: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let stepCounter = 0;
    let totalToolCalls = 0;
    const maxToolCalls = this.config.maxToolCalls ?? this.maxSteps * 5;
    const perToolCounts = new Map<string, number>();

    // Seed memory with system + user message
    this.memory.add({ role: "system", content: this.config.instructions });
    this.memory.add({ role: "user", content: input });

    const toolDefs = this.tools.toOpenAI();

    for (let iteration = 0; iteration < this.maxSteps; iteration++) {
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
        return { steps, output: answer, totalDurationMs: Date.now() - startTime };
      }

      // Case 2: LLM wants to call tools
      if (totalToolCalls + response.tool_calls.length > maxToolCalls) {
        const errorMsg = `Agent exceeded maximum tool calls (${maxToolCalls})`;
        steps.push({ id: `step_${stepCounter++}`, type: "error", content: errorMsg, durationMs: 0 });
        return { steps, output: errorMsg, totalDurationMs: Date.now() - startTime };
      }
      for (const toolCall of response.tool_calls) {
        totalToolCalls++;
        const { name, arguments: argsStr } = toolCall.function;

        // Per-tool call limit (e.g., collect_lead: maxCallsPerRun=1)
        const toolCount = (perToolCounts.get(name) ?? 0) + 1;
        perToolCounts.set(name, toolCount);
        const toolDef = this.tools.get(name);
        if (toolDef?.maxCallsPerRun && toolCount > toolDef.maxCallsPerRun) {
          const limitMsg = `Tool "${name}" exceeded per-run call limit (${toolDef.maxCallsPerRun})`;
          steps.push({ id: `step_${stepCounter++}`, type: "tool_result", toolName: name, toolResult: { success: false, data: null, error: limitMsg }, durationMs: 0 });
          this.memory.add({ role: "tool", content: limitMsg, toolCallId: toolCall.id, toolName: name });
          continue;
        }

        let args: Record<string, unknown>;
        let parseError: string | null = null;
        try {
          args = JSON.parse(argsStr);
        } catch (e) {
          args = {};
          parseError = `Invalid JSON in tool arguments: ${e instanceof Error ? e.message : String(e)}. Raw: ${argsStr.slice(0, 200)}`;
        }

        // Record tool_call step
        steps.push({
          id: `step_${stepCounter++}`,
          type: "tool_call",
          toolName: name,
          toolArgs: args,
          durationMs: 0, // updated after execution
        });

        // If JSON parse failed, feed error back to LLM instead of executing
        let result;
        const execStart = Date.now();
        if (parseError) {
          result = { success: false, data: null, error: parseError };
        } else {
          // Execute with timeout (catch unknown tool names — LLM may hallucinate)
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
        const execDuration = Date.now() - execStart;

        // Update duration on the tool_call step
        steps[steps.length - 1].durationMs = execDuration;

        // Record tool_result step
        steps.push({
          id: `step_${stepCounter++}`,
          type: "tool_result",
          toolName: name,
          toolResult: result,
          durationMs: 0,
        });

        // Feed result back into memory for the next LLM call
        this.memory.add({
          role: "assistant",
          content: `[Tool call: ${name}(${argsStr})]`,
        });
        const maxResultBytes = 32_000; // ~8K tokens, safe for most LLMs
        let resultStr = JSON.stringify(result.data);
        if (resultStr.length > maxResultBytes) {
          resultStr = resultStr.slice(0, maxResultBytes) + `\n...[truncated from ${resultStr.length} to ${maxResultBytes} chars]`;
        }
        this.memory.add({
          role: "tool",
          content: resultStr,
          toolCallId: toolCall.id,
          toolName: name,
        });
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
    return { steps, output: errorMsg, totalDurationMs: Date.now() - startTime };
  }
}
