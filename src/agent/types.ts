/** JSON Schema subset for tool parameter validation. No zod dependency. */
export interface JSONSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

/** Result returned by a tool execution. */
export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/** A tool that an agent can call. */
export interface AgentTool {
  /** Unique name, used in LLM tool_call. Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/ */
  name: string;
  /** Human-readable description for the LLM. */
  description: string;
  /** JSON Schema for parameters. If omitted, tool takes a single string input. */
  parameters?: JSONSchema;
  /** The function that executes the tool. */
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
  /** Maximum times this tool can be called per agent.run(). Prevents prompt injection abuse. */
  maxCallsPerRun?: number;
}

/** A single step in an agent run. */
export interface AgentStep {
  id: string;
  type: "think" | "tool_call" | "tool_result" | "final_answer" | "error";
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  durationMs: number;
}

import type { SkillLoader } from "./skills.js";
import type { ExtensionInitFn } from "./extensions.js";

/** Configuration for conversation memory. */
export interface MemoryConfig {
  /** Maximum number of messages to retain. Default: 50. */
  maxMessages?: number;
  /** Optional hook to transform context before each LLM call. */
  transformContext?: (messages: ChatMessage[]) => ChatMessage[];
}

/** Configuration for creating an Agent. */
export interface AgentConfig {
  /** Display name. */
  name: string;
  /** System instructions for the LLM. */
  instructions: string;
  /** LLM model identifier. Default: "gpt-4o-mini". */
  model?: ModelId | (string & {});
  /** Skills config for dynamic skill loading/resolution. */
  skills?: SkillsConfig;
  /** Extension initializers or module paths. */
  extensions?: Array<ExtensionInitFn | string>;
  /** Forward-compatible MCP server configs. */
  mcp?: MCPServerConfig[];
  /** Execute tool calls in parallel per turn when true. */
  parallelToolExecution?: boolean;
  /**
   * Custom OpenAI-compatible endpoint (Ollama, vLLM, LiteLLM, etc.).
   * When set, bypasses Schift Cloud and calls this endpoint directly.
   * @example "http://localhost:11434/v1" // Ollama
   * @example "http://localhost:8000/v1"  // vLLM
   */
  baseUrl?: string;
  /** API key for the LLM endpoint. Falls back to env var or "no-key" for local. */
  apiKey?: string;
  /** Tools available to the agent. */
  tools?: AgentTool[];
  /** Memory config. If omitted, no memory (stateless). */
  memory?: MemoryConfig;
  /** Maximum ReAct loop iterations. Default: 10. */
  maxSteps?: number;
  /** Timeout for each tool execution in milliseconds. Default: 30000 (30s). */
  toolTimeoutMs?: number;
  /** Maximum total tool calls per run. Default: maxSteps * 5. */
  maxToolCalls?: number;
}

/** Message in a conversation. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

/** The result of a complete agent run. */
export interface AgentRunResult {
  steps: AgentStep[];
  output: string;
  totalDurationMs: number;
}

/** Per-run options. */
export interface RunOptions {
  requestId?: string;
  signal?: AbortSignal;
}

/** Skills runtime configuration. */
export interface SkillsConfig {
  loader: SkillLoader;
  autoResolve?: boolean;
}

/** Policy contract derived from the selected skill for a single run. */
export interface SkillContract {
  skillName: string;
  model?: string;
  allowedTools?: string[];
  blockedTools?: string[];
  procedures?: string[];
  constraints?: string[];
}

/** MCP server configuration (forward compatibility). */
export interface MCPServerConfig {
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  toolPrefix?: string;
}

/** Configuration for the RAG primitive. */
export interface RAGConfig {
  /** Schift bucket ID. */
  bucket: string;
  /** Number of results for search. Default: 5. */
  topK?: number;
}

// ---- Model catalog (2026-03-28) ----

/** OpenAI models available via API (2026-03-28). */
export const OpenAIModel = {
  // GPT-5.4 family
  GPT_5_4: "gpt-5.4",
  GPT_5_4_MINI: "gpt-5.4-mini",
  GPT_5_4_NANO: "gpt-5.4-nano",
  // GPT-4.1 family (coding-optimized)
  GPT_4_1: "gpt-4.1",
  GPT_4_1_MINI: "gpt-4.1-mini",
  GPT_4_1_NANO: "gpt-4.1-nano",
  // GPT-4o (still available in API)
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  // Reasoning models
  O3: "o3",
  O3_MINI: "o3-mini",
  O3_PRO: "o3-pro",
  O4_MINI: "o4-mini",
} as const;

export type OpenAIModel =
  (typeof OpenAIModel)[keyof typeof OpenAIModel];

/** Google Gemini models available via API (2026-03-28). */
export const GeminiModel = {
  // 3.1 family
  GEMINI_3_1_PRO: "gemini-3.1-pro",
  GEMINI_3_1_FLASH: "gemini-3.1-flash",
  GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite",
  // 2.5 family (stable)
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
} as const;

export type GeminiModel =
  (typeof GeminiModel)[keyof typeof GeminiModel];

/** Anthropic Claude models available via API (2026-03-28). */
export const ClaudeModel = {
  OPUS_4_6: "claude-opus-4-6",
  SONNET_4_6: "claude-sonnet-4-6",
  HAIKU_4_5: "claude-haiku-4-5-20251001",
} as const;

export type ClaudeModel =
  (typeof ClaudeModel)[keyof typeof ClaudeModel];

/** All supported LLM models. */
export type ModelId = OpenAIModel | GeminiModel | ClaudeModel;

/** A single web search result. */
export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

/** Supported web search providers. */
export const WebSearchProvider = {
  SCHIFT: "schift",
  TAVILY: "tavily",
  SERPER: "serper",
  BRAVE: "brave",
} as const;

export type WebSearchProvider =
  (typeof WebSearchProvider)[keyof typeof WebSearchProvider];

/** Configuration for DeepResearch. */
export interface DeepResearchConfig {
  /** Maximum research iterations. Default: 3. */
  maxIterations?: number;
  /** Results per search query. Default: 5. */
  resultsPerSearch?: number;
  /** Number of search queries per iteration. Default: 2. */
  queriesPerIteration?: number;
  /** Model for query generation + sufficiency evaluation. Default: "gpt-4o-mini". */
  queryModel?: ModelId | (string & {});
  /** Model for final report synthesis. Default: "gpt-4o-mini". */
  synthesisModel?: ModelId | (string & {});
  /** Web search config (provider, apiKey, etc.). */
  webSearch?: WebSearchConfig;
}

/** Result of a deep research run. */
export interface ResearchReport {
  answer: string;
  sources: WebSearchResultItem[];
  iterations: number;
  totalQueries: number;
}

/** Configuration for WebSearch. */
export interface WebSearchConfig {
  /** Maximum number of results to return. Default: 5. */
  maxResults?: number;
  /** Search provider. Default: "schift" (proxied through Schift Cloud). */
  provider?: WebSearchProvider;
  /** API key for BYOK providers (tavily, serper, brave). Not needed for "schift". */
  providerApiKey?: string;
}
