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
  }

  async run(input: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let stepCounter = 0;

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
      for (const toolCall of response.tool_calls) {
        const { name, arguments: argsStr } = toolCall.function;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsStr);
        } catch {
          args = {};
        }

        // Record tool_call step
        steps.push({
          id: `step_${stepCounter++}`,
          type: "tool_call",
          toolName: name,
          toolArgs: args,
          durationMs: 0, // updated after execution
        });

        // Execute (catch unknown tool names — LLM may hallucinate)
        const execStart = Date.now();
        let result;
        try {
          result = await this.tools.execute(name, args);
        } catch (err) {
          result = {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          };
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
        this.memory.add({
          role: "tool",
          content: JSON.stringify(result.data),
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
