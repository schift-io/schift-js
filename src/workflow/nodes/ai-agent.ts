/**
 * AI Agent workflow node — root agent that consumes the sidecar
 * `agent_languageModel` / `agent_memory` / `agent_tool` ports.
 *
 * Local SDK execution path (this file): single-shot LLM call with the
 * tool catalog rendered into the system prompt. Enough for editor
 * preview + simple workflows that don't actually need to execute tools.
 *
 * Real ReAct loop (think → tool → observe → repeat) runs server-side
 * in `api/server/workflow/nodes/ai_agent.py`, which has access to the
 * full backend (LLM router, BYOK keys, tool sandbox, memory store).
 *
 * Sidecar inputs are merged onto `inputs` by the engine using the
 * connection-type port name. Defensive reads accept both nested and
 * flat shapes so editor preview / unit tests don't have to mimic the
 * production engine's key format precisely.
 */
import { SDKBaseNode, getEnvApiKey } from "./base.js";
import type { SDKExecutionContext } from "./base.js";

interface ToolSpec {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
}

interface AgentInputs {
  // Main input variants — accept any of these as the user prompt.
  prompt?: string;
  text?: string;
  query?: string;
  in?: string;
  // Sidecar inputs.
  agent_languageModel?: {
    provider?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    apiKey?: string;
    base_url?: string;
  };
  agent_memory?: {
    messages?: Array<{ role: string; content: string }>;
  };
  agent_tool?: ToolSpec[] | ToolSpec;
}

type FailureBehaviour = "fail" | "partial" | "empty";

export class AIAgentNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    _ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const cfg = this.config;
    const systemPrompt = (cfg.systemPrompt as string) ?? "You are a helpful assistant.";
    const maxTokens = Number(cfg.tokenBudget ?? 1024) || 1024;
    const onError = ((cfg.onError as string) ?? "fail") as FailureBehaviour;

    const i = inputs as AgentInputs;
    const userPrompt = i.prompt ?? i.text ?? i.query ?? i.in ?? "";
    const lm = i.agent_languageModel;
    const memory = i.agent_memory;
    const tools = Array.isArray(i.agent_tool)
      ? i.agent_tool
      : i.agent_tool
        ? [i.agent_tool]
        : [];

    if (!userPrompt) {
      return this.failure(onError, "Main input is empty — agent has no prompt to act on.");
    }
    if (!lm || !lm.provider) {
      return this.failure(
        onError,
        "agent_languageModel sidecar is required. Connect a Language Model node to this agent.",
      );
    }

    // Render tools into the system prompt so the model "knows" them even
    // when we can't actually invoke them locally. Real tool execution is
    // server-side. Format mirrors the OpenAI tool-use convention so the
    // model understands the shape.
    const toolBlock = tools.length
      ? "\n\nAvailable tools (you do NOT execute them in this local preview — describe what you would call):\n" +
        tools
          .map(
            (t, ix) =>
              `${ix + 1}. ${t.name}${t.description ? ` — ${t.description}` : ""}`,
          )
          .join("\n")
      : "";

    const finalSystem = `${lm.systemPrompt ?? systemPrompt}${toolBlock}`;
    const messages: Array<{ role: string; content: string }> = [];
    messages.push({ role: "system", content: finalSystem });
    if (memory?.messages?.length) {
      for (const m of memory.messages) {
        messages.push(m);
      }
    }
    messages.push({ role: "user", content: userPrompt });

    let answer: string;
    let tokensUsed = 0;
    try {
      const result = await callLLM(lm, messages, {
        temperature: lm.temperature ?? 0.7,
        maxTokens,
      });
      answer = result.text;
      tokensUsed = result.tokensUsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return this.failure(onError, `LLM call failed: ${msg}`);
    }

    return {
      answer,
      text: answer,
      out: answer,
      steps: [], // populated only by the server-side full-ReAct path
      tokensUsed,
      finishReason: "final" as const,
    };
  }

  private failure(behaviour: FailureBehaviour, reason: string): Record<string, unknown> {
    if (behaviour === "fail") {
      throw new Error(reason);
    }
    return {
      answer: "",
      text: "",
      out: "",
      steps: [],
      tokensUsed: 0,
      finishReason: "error",
      error: reason,
      ...(behaviour === "partial" ? { partial: true } : {}),
    };
  }
}

interface LLMResult {
  text: string;
  tokensUsed: number;
}

async function callLLM(
  lm: NonNullable<AgentInputs["agent_languageModel"]>,
  messages: Array<{ role: string; content: string }>,
  opts: { temperature: number; maxTokens: number },
): Promise<LLMResult> {
  const provider = lm.provider!;
  const model = lm.model ?? defaultModel(provider);
  const apiKey = lm.apiKey ?? lookupKey(provider);
  if (!apiKey) {
    throw new Error(`No API key for provider '${provider}'. Set it in the LLM node config or env.`);
  }

  const baseUrl = lm.base_url ?? defaultBaseUrl(provider);
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens ?? 0;
  return { text, tokensUsed };
}

function defaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-haiku-4-5-20251001";
    case "google":
      return "gemini-2.5-flash";
    case "ollama":
      return "llama3";
    case "schift":
      return "schift-default";
    default:
      return "gpt-4o-mini";
  }
}

function defaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta/openai";
    case "ollama":
      return "http://localhost:11434/v1";
    case "schift":
      return process.env.SCHIFT_API_URL?.replace(/\/$/, "") + "/v1" || "https://api.schift.io/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

function lookupKey(provider: string): string {
  try {
    return getEnvApiKey(provider);
  } catch {
    return "";
  }
}
