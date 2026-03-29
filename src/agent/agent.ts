import type { AgentConfig, AgentTool, AgentRunResult, ChatMessage } from "./types.js";
import type { LLMCallFn } from "./runtime.js";
import { AgentRuntime } from "./runtime.js";
import { ToolRegistry } from "./tools.js";
import { ConversationMemory } from "./memory.js";
import { RAG } from "./rag.js";

interface Transport {
  post: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
}

export interface AgentOptions extends AgentConfig {
  /**
   * HTTP transport (from Schift client).
   * Required for Schift Cloud mode. Not needed when baseUrl is set.
   */
  transport?: Transport;
  /** RAG instance — auto-registers as a tool. */
  rag?: RAG;
}

/**
 * Agent — the top-level user-facing API.
 *
 * Supports three LLM connection modes:
 *
 * 1. **Schift Cloud** (default): routes through Schift /v1/chat/completions
 * 2. **Direct provider**: set baseUrl to OpenAI/Google/Anthropic endpoint
 * 3. **Self-hosted**: set baseUrl to Ollama/vLLM/LiteLLM endpoint
 *
 * @example Schift Cloud
 * ```ts
 * const agent = new Agent({
 *   name: "Support Bot",
 *   instructions: "You are a helpful support agent.",
 *   model: OpenAIModel.GPT_4O_MINI,
 *   transport: schift.transport,
 * });
 * ```
 *
 * @example Ollama (self-hosted)
 * ```ts
 * const agent = new Agent({
 *   name: "Local Bot",
 *   instructions: "You are a helpful assistant.",
 *   model: "llama3",
 *   baseUrl: "http://localhost:11434/v1",
 * });
 * ```
 *
 * @example vLLM
 * ```ts
 * const agent = new Agent({
 *   name: "vLLM Bot",
 *   model: "mistralai/Mistral-7B-Instruct-v0.3",
 *   baseUrl: "http://localhost:8000/v1",
 * });
 * ```
 */
export class Agent {
  readonly name: string;
  private readonly config: AgentConfig;
  private readonly registry: ToolRegistry;
  private readonly transport: Transport | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: AgentOptions) {
    this.name = options.name;
    this.config = options;
    this.transport = options.transport ?? null;
    this.model = options.model ?? "gpt-4o-mini";
    this.baseUrl = options.baseUrl ?? "";
    this.apiKey = options.apiKey ?? "";
    this.registry = new ToolRegistry();

    // Validate: need either transport or baseUrl
    if (!this.transport && !this.baseUrl) {
      throw new Error(
        "Agent requires either transport (Schift Cloud) or baseUrl (OpenAI-compatible endpoint).",
      );
    }

    // Register explicit tools
    for (const tool of options.tools ?? []) {
      this.registry.register(tool);
    }

    // Auto-register RAG as tool
    if (options.rag) {
      this.registry.register(options.rag.asTool());
    }
  }

  /** Number of registered tools. */
  get toolCount(): number {
    return this.registry.list().length;
  }

  /**
   * Run the agent with a user message. Returns the final result.
   *
   * @param input - User message to process
   * @param options - Optional run-level overrides
   * @param options.requestId - Idempotency key. If the same requestId is used
   *   after a crash/retry, the server can deduplicate the request.
   */
  async run(
    input: string,
    options?: { requestId?: string },
  ): Promise<AgentRunResult> {
    const memory = new ConversationMemory(this.config.memory);
    const llm = this.createLLMFn(options?.requestId);
    const runtime = new AgentRuntime(this.config, this.registry, memory, llm);
    return runtime.run(input);
  }

  /** Create the LLM call function. Routes to Schift Cloud or custom endpoint. */
  private createLLMFn(requestId?: string): LLMCallFn {
    // Custom endpoint (Ollama, vLLM, OpenAI direct, etc.)
    if (this.baseUrl) {
      return this.createDirectLLMFn(requestId);
    }

    // Schift Cloud (via transport)
    return async (messages, tools) => {
      const resp = await this.transport!.post<{
        choices: Array<{
          message: {
            content?: string;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      }>("/v1/chat/completions", {
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        })),
        ...(tools.length > 0 ? { tools } : {}),
        ...(requestId ? { request_id: requestId } : {}),
      });
      return resp.choices[0].message;
    };
  }

  /** Direct OpenAI-compatible API call (no Schift Cloud). */
  private createDirectLLMFn(requestId?: string): LLMCallFn {
    const base = this.baseUrl.replace(/\/+$/, "");
    const endpoint = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    const apiKey = this.apiKey || "no-key";
    const maxRetries = 3;
    const backoffMs = [1000, 2000, 4000];

    return async (messages, tools) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(requestId ? { "X-Request-Id": requestId } : {}),
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
            })),
            ...(tools.length > 0 ? { tools } : {}),
          }),
        });

        if (resp.status === 429 && attempt < maxRetries) {
          const retryAfter = resp.headers.get("retry-after");
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs[attempt];
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!resp.ok) {
          throw new Error(`LLM API error: ${resp.status} ${resp.statusText}`);
        }

        const data = (await resp.json()) as {
          choices: Array<{
            message: {
              content?: string;
              tool_calls?: Array<{
                id: string;
                function: { name: string; arguments: string };
              }>;
            };
          }>;
        };

        return data.choices[0].message;
      }

      throw new Error(`LLM API error: 429 rate limited after ${maxRetries} retries`);
    };
  }
}
