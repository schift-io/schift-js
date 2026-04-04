import type { AgentConfig, AgentRunResult, RunOptions, SkillContract } from "./types.js";
import type { LLMCallFn } from "./runtime.js";
import { AgentRuntime } from "./runtime.js";
import { ToolRegistry } from "./tools.js";
import { ConversationMemory } from "./memory.js";
import { RAG } from "./rag.js";
import { AgentEventEmitter, type AgentEventType, type AgentEventMap } from "./events.js";
import { SkillResolver } from "./skills.js";
import { ExtensionHost, type ExtensionAPI } from "./extensions.js";
import { PolicyEngine } from "./policy.js";

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

export class Agent {
  readonly name: string;
  private readonly config: AgentConfig;
  private readonly registry: ToolRegistry;
  private readonly transport: Transport | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly emitter: AgentEventEmitter;
  private readonly extensionHost: ExtensionHost;
  private readonly skillResolver: SkillResolver | null;
  private initialized = false;

  constructor(options: AgentOptions) {
    this.name = options.name;
    this.config = options;
    this.transport = options.transport ?? null;
    this.model = options.model ?? "gpt-4o-mini";
    this.baseUrl = options.baseUrl ?? "";
    this.apiKey = options.apiKey ?? "";
    this.registry = new ToolRegistry();
    this.emitter = new AgentEventEmitter();
    this.skillResolver = options.skills ? new SkillResolver(options.skills.loader) : null;

    const extensionApi: ExtensionAPI = {
      registerTool: (tool) => this.registry.register(tool),
      on: (type, handler) => this.emitter.on(type, handler),
      off: (type, handler) => this.emitter.off(type, handler),
      agentName: this.name,
    };
    this.extensionHost = new ExtensionHost(extensionApi);

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

  on<K extends AgentEventType>(
    type: K,
    handler: (event: AgentEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(type, handler);
  }

  off<K extends AgentEventType>(
    type: K,
    handler: (event: AgentEventMap[K]) => void,
  ): void {
    this.emitter.off(type, handler);
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    for (const ext of this.config.extensions ?? []) {
      await this.extensionHost.load(ext);
    }

    if (this.config.skills) {
      const loaded = await this.config.skills.loader.getAll();
      for (const skill of loaded) {
        const bucket = skill.meta.rag?.trim();
        if (!bucket || !this.transport) continue;
        const toolName = `rag_${bucket.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        if (!this.registry.has(toolName)) {
          this.registry.register(new RAG({ bucket }, this.transport).asTool(toolName));
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Run the agent with a user message. Returns the final result.
   */
  async run(input: string, options?: RunOptions): Promise<AgentRunResult> {
    await this.init();

    let runtimeConfig: AgentConfig = this.config;
    let runtimeTools = this.registry;
    let runtimeModel = this.model;
    let runtimeContract: SkillContract | undefined;

    if (this.skillResolver && this.config.skills?.autoResolve !== false) {
      const resolved = await this.skillResolver.resolvePrimary(input);
      const skill = resolved?.skill;
      const selectedSkills = skill ? [skill] : [];
      const section = this.skillResolver.buildPromptSection(selectedSkills);

      runtimeConfig = {
        ...this.config,
        instructions: section.promptText
          ? `${this.config.instructions}\n\n${section.promptText}`
          : this.config.instructions,
      };

      let filteredTools = this.registry;
      if (section.allowedTools) {
        filteredTools = filteredTools.filtered(section.allowedTools);
      }

      const blockedTools = new Set(skill?.meta["blocked-tools"] ?? []);
      if (blockedTools.size > 0) {
        filteredTools = filteredTools.without(blockedTools);
      }
      runtimeTools = filteredTools;

      runtimeContract = skill
        ? {
            skillName: skill.meta.name,
            model: skill.meta.model,
            allowedTools: skill.meta["allowed-tools"],
            blockedTools: skill.meta["blocked-tools"],
            procedures: skill.meta.procedures,
            constraints: skill.meta.constraints,
          }
        : undefined;

      runtimeModel = runtimeContract?.model ?? this.model;
    }

    const memory = new ConversationMemory(runtimeConfig.memory);
    const llm = this.createLLMFn(options?.requestId, runtimeModel);
    const runtime = new AgentRuntime(runtimeConfig, runtimeTools, memory, llm, {
      emitter: this.emitter,
      signal: options?.signal,
      policyEngine: runtimeContract ? new PolicyEngine(runtimeContract) : undefined,
      skillName: runtimeContract?.skillName,
    });
    return runtime.run(input);
  }

  /** Create the LLM call function. Routes to Schift Cloud or custom endpoint. */
  private createLLMFn(requestId?: string, runModel?: string): LLMCallFn {
    if (this.baseUrl) {
      return this.createDirectLLMFn(requestId, runModel);
    }

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
        model: runModel ?? this.model,
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
  private createDirectLLMFn(requestId?: string, runModel?: string): LLMCallFn {
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
            model: runModel ?? this.model,
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
          const parsedRetryAfter = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
          const delay = Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
            ? parsedRetryAfter * 1000
            : backoffMs[attempt] ?? 1000;
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
