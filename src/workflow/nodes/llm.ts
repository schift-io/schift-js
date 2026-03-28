import { SDKBaseNode, getEnvApiKey } from "./base.js";

/**
 * LLM Node — supports Schift Cloud, OpenAI, Google, and any OpenAI-compatible
 * endpoint (Ollama, vLLM, LiteLLM, TGI, etc.).
 *
 * Config:
 *   model:       "openai/gpt-4o-mini" | "google/gemini-2.5-flash" | "ollama/llama3"
 *   base_url:    Custom OpenAI-compatible endpoint (e.g. "http://localhost:11434/v1")
 *   api_key:     Override API key (optional, defaults to env var)
 *   temperature: 0.0-2.0 (default 0.7)
 *   max_tokens:  (default 1024)
 *
 * Resolution order for endpoint:
 *   1. config.base_url     → custom endpoint (Ollama, vLLM, etc.)
 *   2. SCHIFT_API_URL env  → Schift Cloud proxy
 *   3. provider default    → openai.com, google, etc.
 */
export class LLMNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const modelStr = (this.config.model as string) ?? "openai/gpt-4o-mini";
    const temperature = (this.config.temperature as number) ?? 0.7;
    const maxTokens = (this.config.max_tokens as number) ?? 1024;
    const baseUrl = (this.config.base_url as string) ?? "";
    const configApiKey = (this.config.api_key as string) ?? "";

    let prompt = (inputs.prompt as string) ?? "";
    const systemPrompt = (inputs.system_prompt as string) ?? "";
    const context = (inputs.context as string) ?? "";

    if (context && !prompt.includes("{{context}}")) {
      prompt = `Context:\n${context}\n\n${prompt}`;
    }

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const [provider, modelName] = modelStr.includes("/")
      ? modelStr.split("/", 2)
      : ["openai", modelStr];

    // Resolve endpoint
    const endpoint = this.resolveEndpoint(provider, baseUrl);

    // Resolve API key: config override > env var
    // For local endpoints (Ollama, vLLM), api_key is often not needed — use "no-key"
    let apiKey: string;
    if (configApiKey) {
      apiKey = configApiKey;
    } else if (baseUrl) {
      // Custom endpoint: try env, fall back to dummy (Ollama doesn't need auth)
      try { apiKey = getEnvApiKey(provider); } catch { apiKey = "no-key"; }
    } else {
      apiKey = getEnvApiKey(provider);
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!resp.ok) {
      throw new Error(`LLM API error: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      choices: { message: { content: string } }[];
      usage?: Record<string, unknown>;
    };

    const text = data.choices[0].message.content;
    const usage = data.usage ?? {};

    return { text, usage };
  }

  private resolveEndpoint(provider: string, baseUrl: string): string {
    // 1. Explicit base_url (Ollama, vLLM, any OpenAI-compatible)
    if (baseUrl) {
      const base = baseUrl.replace(/\/+$/, "");
      return base.endsWith("/chat/completions")
        ? base
        : `${base}/chat/completions`;
    }

    // 2. Schift Cloud proxy
    const schiftBaseUrl = process.env.SCHIFT_API_URL ?? process.env.SCHIFT_BASE_URL;
    if (schiftBaseUrl) {
      return `${schiftBaseUrl}/v1/chat/completions`;
    }

    // 3. Known provider defaults
    const PROVIDER_ENDPOINTS: Record<string, string> = {
      openai: "https://api.openai.com/v1/chat/completions",
      google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      ollama: "http://localhost:11434/v1/chat/completions",
    };

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (endpoint) return endpoint;

    throw new Error(
      `LLM provider '${provider}' is not supported. ` +
      `Set base_url in config for custom endpoints, or use: ${Object.keys(PROVIDER_ENDPOINTS).join(", ")}.`,
    );
  }
}

export class MetadataExtractorNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const strategy = (this.config.strategy as string) ?? "regex";

    const texts: string[] = [];
    const text = inputs.text as string | undefined;
    if (text) texts.push(text);
    const docs = (inputs.documents as Record<string, unknown>[]) ?? [];
    for (const doc of docs) {
      texts.push((doc.content as string) ?? "");
    }

    if (!texts.length) {
      return { metadata: [] };
    }

    if (strategy === "llm") {
      throw new Error(
        "LLM-based metadata extraction is not supported in the SDK engine. " +
          "Use 'regex' strategy or register a custom node.",
      );
    }

    return this.extractRegex(texts);
  }

  private extractRegex(texts: string[]): Record<string, unknown> {
    const fields =
      (this.config.fields as Record<string, unknown>[]) ?? [];
    const allMetadata: Record<string, unknown>[] = [];

    for (const text of texts) {
      const meta: Record<string, unknown> = {};
      for (const fieldDef of fields) {
        const name = (fieldDef.name as string) ?? "";
        const pattern = (fieldDef.pattern as string) ?? "";
        const fieldType = (fieldDef.type as string) ?? "str";
        if (!name || !pattern) continue;

        const match = text.match(new RegExp(pattern));
        if (match) {
          const value = match[1] ?? match[0];
          meta[name] = MetadataExtractorNode.cast(value, fieldType);
        } else {
          meta[name] = null;
        }
      }
      allMetadata.push(meta);
    }
    return { metadata: allMetadata };
  }

  static cast(value: string, fieldType: string): unknown {
    try {
      if (fieldType === "int") return parseInt(value, 10);
      if (fieldType === "float") return parseFloat(value);
      if (fieldType === "bool")
        return ["true", "1", "yes"].includes(value.toLowerCase());
    } catch {
      // fall through
    }
    return value;
  }
}
