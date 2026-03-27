/**
 * Node handlers for the SDK workflow execution engine.
 *
 * Tier 1 — fully local execution (control, logic, transform).
 * Tier 2 — delegates to Schift API or external LLM APIs.
 * Tier 3 — server-only stubs (throw Error).
 *
 * Custom nodes:
 *
 *   import { SDKBaseNode, registerCustomNode } from "@schift-io/sdk";
 *
 *   class SentimentNode extends SDKBaseNode {
 *     async execute(inputs, ctx) {
 *       return { score: 0.9, label: "positive" };
 *     }
 *   }
 *
 *   registerCustomNode("sentiment_analyzer", SentimentNode);
 */

import type { BlockDef } from "./yaml.js";

// ---- Execution Context (forward ref to avoid circular) ----

export interface SDKExecutionContext {
  client?: unknown;
  runId: string;
  variables: Record<string, unknown>;
  getVar(key: string, defaultValue?: unknown): unknown;
  setVar(key: string, value: unknown): void;
}

// ---- Base Node ----

export abstract class SDKBaseNode {
  readonly block: BlockDef;
  readonly config: Record<string, unknown>;

  constructor(block: BlockDef) {
    this.block = block;
    this.config = block.config ?? {};
  }

  abstract execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>>;

  validateConfig(): string[] {
    return [];
  }
}

// ---- Helpers ----

async function maybeAwait<T>(result: T | Promise<T>): Promise<T> {
  if (result && typeof (result as Promise<T>).then === "function") {
    return result as Promise<T>;
  }
  return result as T;
}

function getEnvApiKey(provider: string): string {
  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
  };
  const envVar = envMap[provider] ?? `${provider.toUpperCase()}_API_KEY`;
  const key = process.env[envVar] ?? "";
  if (!key) {
    throw new Error(
      `No API key for provider '${provider}'. Set the ${envVar} environment variable.`,
    );
  }
  return key;
}

// ============================================================
// Tier 1 — Control Flow
// ============================================================

class StartNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return inputs;
  }
}

class EndNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return { result: inputs };
  }
}

class PassthroughNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return inputs;
  }
}

// ============================================================
// Tier 1 — Logic
// ============================================================

class ConditionNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const field = (this.config.field as string) ?? "";
    const operator = (this.config.operator as string) ?? "eq";
    const expected = this.config.value;
    const actual = inputs[field];
    const result = ConditionNode.evaluate(actual, operator, expected);
    return { branch: result ? "true" : "false", data: inputs };
  }

  static evaluate(actual: unknown, op: string, expected: unknown): boolean {
    switch (op) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return Number(actual ?? 0) > Number(expected ?? 0);
      case "lt":
        return Number(actual ?? 0) < Number(expected ?? 0);
      case "gte":
        return Number(actual ?? 0) >= Number(expected ?? 0);
      case "lte":
        return Number(actual ?? 0) <= Number(expected ?? 0);
      case "contains":
        return String(actual ?? "").includes(String(expected ?? ""));
      case "empty":
        return !actual;
      case "not_empty":
        return Boolean(actual);
      default:
        return false;
    }
  }
}

class MergeNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return { merged: inputs };
  }
}

class LoopNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const inputKey = (this.config.input_key as string) ?? "items";
    const itemKey = (this.config.item_key as string) ?? "item";
    const indexKey = (this.config.index_key as string) ?? "index";
    const maxIter = (this.config.max_iterations as number) ?? 100;

    let items = inputs[inputKey];
    if (!Array.isArray(items)) {
      items = items != null ? [items] : [];
    }
    const arr = items as unknown[];

    if (arr.length > maxIter) {
      throw new Error(
        `Loop has ${arr.length} items, exceeds max_iterations=${maxIter}`,
      );
    }

    const iterations = arr.map((item, i) => ({
      [itemKey]: item,
      [indexKey]: i,
      total: arr.length,
      is_last: i === arr.length - 1,
    }));

    ctx.setVar(`${this.block.id}.iterations`, iterations);
    ctx.setVar(`${this.block.id}.count`, arr.length);

    return {
      iterations,
      count: arr.length,
      [itemKey]: arr.length > 0 ? arr[0] : null,
      [indexKey]: 0,
      total: arr.length,
      is_last: arr.length <= 1,
    };
  }

  validateConfig(): string[] {
    const errors: string[] = [];
    const maxIter = this.config.max_iterations;
    if (maxIter != null && (typeof maxIter !== "number" || maxIter < 1)) {
      errors.push("max_iterations must be a positive integer");
    }
    return errors;
  }
}

class RouterNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const query = String(inputs.query ?? "").toLowerCase();
    const strategy = (this.config.strategy as string) ?? "keyword";
    const routes = (this.config.routes as Record<string, unknown>[]) ?? [];
    const defaultRoute = (this.config.default_route as string) ?? "default";

    if (!query || !routes.length) {
      return { route: defaultRoute, confidence: 0.0, data: inputs };
    }

    if (strategy === "keyword") {
      return RouterNode.routeKeyword(query, routes, defaultRoute, inputs);
    } else if (strategy === "regex") {
      return RouterNode.routeRegex(query, routes, defaultRoute, inputs);
    } else if (strategy === "llm") {
      throw new Error(
        "LLM-based routing is not supported in the SDK engine. " +
          "Use 'keyword' or 'regex' strategy, or register a custom node.",
      );
    }
    return { route: defaultRoute, confidence: 0.0, data: inputs };
  }

  static routeKeyword(
    query: string,
    routes: Record<string, unknown>[],
    defaultRoute: string,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    let bestRoute = defaultRoute;
    let bestScore = 0;
    for (const route of routes) {
      const name = (route.name as string) ?? "";
      let keywords = route.condition;
      if (typeof keywords === "string") {
        keywords = keywords.split(",").map((k: string) => k.trim());
      }
      const kwArr = (keywords as string[]) ?? [];
      const hits = kwArr.filter((kw) => query.includes(kw.toLowerCase())).length;
      const score = hits / Math.max(kwArr.length, 1);
      if (score > bestScore) {
        bestScore = score;
        bestRoute = name;
      }
    }
    return { route: bestRoute, confidence: bestScore, data: inputs };
  }

  static routeRegex(
    query: string,
    routes: Record<string, unknown>[],
    defaultRoute: string,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    for (const route of routes) {
      const name = (route.name as string) ?? "";
      const pattern = (route.condition as string) ?? "";
      if (pattern && new RegExp(pattern, "i").test(query)) {
        return { route: name, confidence: 1.0, data: inputs };
      }
    }
    return { route: defaultRoute, confidence: 0.0, data: inputs };
  }
}

// ============================================================
// Tier 1 — Transform / Output
// ============================================================

class VariableNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const mode = (this.config.mode as string) ?? "set_get";
    let result: Record<string, unknown> = {};

    if (mode === "set" || mode === "set_get") {
      const vars = (this.config.variables as Record<string, unknown>) ?? {};
      for (const [key, value] of Object.entries(vars)) {
        ctx.setVar(key, value);
      }
      for (const [key, value] of Object.entries(inputs)) {
        ctx.setVar(key, value);
      }
    }

    if (mode === "get" || mode === "set_get") {
      const keys = (this.config.keys as string[]) ?? [];
      if (keys.length) {
        for (const key of keys) {
          result[key] = ctx.getVar(key);
        }
      } else {
        result = { ...ctx.variables };
      }
    }

    return result;
  }
}

function formatItem(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    const text =
      (obj.text as string) ??
      ((obj.metadata as Record<string, unknown>)?.text as string) ??
      "";
    const score = obj.score;
    const parts = [text];
    if (score != null && score !== "") {
      parts.push(`(score: ${score})`);
    }
    return parts.join(" ");
  }
  return String(item);
}

class PromptTemplateNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const template = (this.config.template as string) ?? "{{query}}";
    const systemPromptTemplate = (this.config.system_prompt as string) ?? "";

    function replaceVar(_match: string, varName: string): string {
      const name = varName.trim();
      const value = inputs[name] ?? ctx.getVar(name, "");
      if (Array.isArray(value)) {
        return value.map((v) => `- ${formatItem(v)}`).join("\n");
      }
      return String(value);
    }

    const prompt = template.replace(/\{\{(.+?)\}\}/g, replaceVar);
    const systemPrompt = systemPromptTemplate.replace(
      /\{\{(.+?)\}\}/g,
      replaceVar,
    );
    return { prompt, system_prompt: systemPrompt };
  }
}

class AnswerNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let text = (inputs.text as string) ?? "";
    const results = (inputs.results as Record<string, unknown>[]) ?? [];
    const fmt = (this.config.format as string) ?? "text";
    const includeSources = (this.config.include_sources as boolean) ?? true;
    const maxLength = this.config.max_length as number | undefined;

    if (maxLength && text.length > maxLength) {
      text = text.slice(0, maxLength) + "...";
    }

    const sources: Record<string, unknown>[] = [];
    if (includeSources && results.length) {
      for (const r of results) {
        const source: Record<string, unknown> = {
          id: r.id ?? "",
          score: r.score ?? 0,
        };
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        if (meta.source) source.source = meta.source;
        if (meta.text) source.snippet = String(meta.text).slice(0, 200);
        sources.push(source);
      }
    }

    let answer: string;
    if (fmt === "markdown" && sources.length) {
      const sourceSection =
        "\n\n---\n**Sources:**\n" +
        sources
          .map(
            (s) =>
              `- ${s.source ?? s.id} (score: ${s.score ?? "N/A"})`,
          )
          .join("\n");
      answer = text + sourceSection;
    } else if (fmt === "json") {
      answer = JSON.stringify({ text, sources });
    } else {
      answer = text;
    }

    return { answer, sources, format: fmt };
  }
}

class ModelSelectorNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const model = (this.config.model as string) ?? "";
    return { model, ...inputs };
  }
}

function resolvePath(data: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;

  for (let i = 0; i < parts.length; i++) {
    if (current == null) return null;
    const part = parts[i];
    const m = part.match(/^(\w+)\[(\d*)\]$/);

    if (m) {
      const key = m[1];
      const idx = m[2];
      current =
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : null;
      if (current == null) return null;

      if (idx) {
        const idxInt = parseInt(idx, 10);
        if (Array.isArray(current) && idxInt < current.length) {
          current = current[idxInt];
        } else {
          return null;
        }
      } else {
        const remaining = parts.slice(i + 1).join(".");
        if (!remaining) return current;
        if (Array.isArray(current)) {
          const results = current.map((item) => resolvePath(item, remaining));
          const flat: unknown[] = [];
          for (const r of results) {
            if (Array.isArray(r)) {
              flat.push(...r);
            } else if (r != null) {
              flat.push(r);
            }
          }
          return flat;
        }
        return null;
      }
    } else {
      current =
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : null;
    }
  }

  return current;
}

class FieldSelectorNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const fields = (this.config.fields as string[]) ?? [];
    const rename = (this.config.rename as Record<string, string>) ?? {};
    const flatten = (this.config.flatten as boolean) ?? false;

    if (!fields.length) {
      return { out: {}, columns: {} };
    }

    let data: unknown = inputs.in ?? inputs;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    let result: Record<string, unknown> = {};
    const columns: Record<string, unknown> = {};

    for (const fieldPath of fields) {
      const outputKey =
        rename[fieldPath] ?? fieldPath.replace(/\[\]/g, "").replace(/\./g, "_");
      const value = resolvePath(data, fieldPath);
      result[outputKey] = value;
      if (Array.isArray(value)) {
        columns[outputKey] = value;
      }
    }

    if (flatten) {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(
            v as Record<string, unknown>,
          )) {
            flat[`${k}_${sk}`] = sv;
          }
        } else {
          flat[k] = v;
        }
      }
      result = flat;
    }

    return { out: result, columns };
  }
}

// ============================================================
// Tier 2 — API Delegation (Schift API)
// ============================================================

class EmbedderNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error(
        "EmbedderNode requires a Schift Client in the execution context",
      );
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const model = this.config.model as string | undefined;
    const text = (inputs.text as string) ?? "";
    const texts = (inputs.texts as string[]) ?? [];

    if (texts.length) {
      const results = await maybeAwait(
        client.embedBatch(texts, { model }) as Promise<{ values: number[] }[]>,
      );
      const embeddings = results.map((r: { values: number[] }) => r.values);
      return { embeddings, model: model ?? "" };
    } else if (text) {
      const result = await maybeAwait(
        client.embed(text, { model }) as Promise<{
          values: number[];
          model: string;
        }>,
      );
      return { embedding: result.values, model: result.model };
    }
    return { embedding: [], model: model ?? "" };
  }
}

class RetrieverNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("RetrieverNode requires a Schift Client");
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const collectionName = (this.config.collection as string) ?? "";
    const topK = (this.config.top_k as number) ?? 10;
    const query = (inputs.query as string) ?? "";

    if (!collectionName) {
      throw new Error("RetrieverNode requires 'collection' in config");
    }
    if (!query) {
      return { results: [] };
    }

    const collection = client.collection(collectionName) as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const results = (await maybeAwait(
      collection.search(query, { topK }) as Promise<
        { id: string; score: number; text: string; metadata: unknown }[]
      >,
    )) as Record<string, unknown>[];

    return {
      results: results.map((r) => ({
        id: r.id ?? "",
        score: r.score ?? 0,
        text: r.text ?? "",
        metadata: r.metadata ?? {},
      })),
      query,
    };
  }
}

class RerankerNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const results = (inputs.results as Record<string, unknown>[]) ?? [];
    const topK = (this.config.top_k as number) ?? 10;

    const sorted = [...results]
      .sort(
        (a, b) =>
          Number(b.score ?? 0) - Number(a.score ?? 0),
      )
      .slice(0, topK);

    return { results: sorted };
  }
}

class VectorStoreNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("VectorStoreNode requires a Schift Client");
    }

    const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
    const collectionName = (this.config.collection as string) ?? "";
    if (!collectionName) {
      throw new Error("VectorStoreNode requires 'collection' in config");
    }

    const collection = client.collection(collectionName) as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const documents = (inputs.documents as string[]) ?? [];
    const vectors = (inputs.vectors as unknown[]) ?? [];

    if (documents.length) {
      const model = this.config.model as string | undefined;
      const result = await maybeAwait(collection.add(documents, { model }));
      return { stored: documents.length, result };
    } else if (vectors.length) {
      const result = await maybeAwait(collection.upsert(vectors));
      return { stored: vectors.length, result };
    }

    return { stored: 0 };
  }
}

class CollectionNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!ctx.client) {
      throw new Error("CollectionNode requires a Schift Client");
    }

    const name =
      (this.config.collection as string) ??
      (this.config.name as string) ??
      "";
    return { collection: name, ...inputs };
  }
}

// ============================================================
// Tier 2 — External LLM APIs
// ============================================================

class LLMNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const modelStr = (this.config.model as string) ?? "openai/gpt-4o-mini";
    const temperature = (this.config.temperature as number) ?? 0.7;
    const maxTokens = (this.config.max_tokens as number) ?? 1024;

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

    const apiKey = getEnvApiKey(provider);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
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
}

class MetadataExtractorNode extends SDKBaseNode {
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

// ============================================================
// Tier 3 — Server-Only Stubs
// ============================================================

class ServerOnlyNode extends SDKBaseNode {
  async execute(): Promise<Record<string, unknown>> {
    throw new Error(
      `Block type '${this.block.type}' is server-only and cannot be ` +
        `executed in the local SDK engine. Use the Schift API to run ` +
        `workflows containing this block type.`,
    );
  }
}

// ============================================================
// Registry
// ============================================================

const BUILTIN_HANDLERS: Record<string, new (block: BlockDef) => SDKBaseNode> = {
  // Tier 1 — Control
  start: StartNode,
  end: EndNode,
  // Tier 1 — Logic
  condition: ConditionNode,
  router: RouterNode,
  loop: LoopNode,
  merge: MergeNode,
  // Tier 1 — Transform / Output
  variable: VariableNode,
  prompt_template: PromptTemplateNode,
  answer: AnswerNode,
  field_selector: FieldSelectorNode,
  model_selector: ModelSelectorNode,
  // Tier 2 — Schift API
  embedder: EmbedderNode,
  retriever: RetrieverNode,
  reranker: RerankerNode,
  vector_store: VectorStoreNode,
  collection: CollectionNode,
  // Tier 2 — External LLM
  llm: LLMNode,
  metadata_extractor: MetadataExtractorNode,
  // Tier 3 — Server-only
  ai_router: ServerOnlyNode,
  document_loader: ServerOnlyNode,
  document_parser: ServerOnlyNode,
  chunker: ServerOnlyNode,
  code: ServerOnlyNode,
  http_request: ServerOnlyNode,
  webhook: ServerOnlyNode,
  webhook_source: ServerOnlyNode,
  ingest_bridge: ServerOnlyNode,
  feed_poll: ServerOnlyNode,
  notify: PassthroughNode,
};

const CUSTOM_NODES: Record<
  string,
  new (block: BlockDef) => SDKBaseNode
> = {};

/**
 * Register a custom node handler.
 *
 * @param blockType - Unique type identifier (e.g. "sentiment_analyzer").
 * @param handlerCls - A class extending SDKBaseNode.
 * @throws if the type collides with a built-in type.
 */
export function registerCustomNode(
  blockType: string,
  handlerCls: new (block: BlockDef) => SDKBaseNode,
): void {
  if (blockType in BUILTIN_HANDLERS) {
    throw new Error(
      `Cannot override built-in block type '${blockType}'. ` +
        "Choose a unique type name for your custom node.",
    );
  }
  CUSTOM_NODES[blockType] = handlerCls;
}

/**
 * Remove a previously registered custom node.
 */
export function unregisterCustomNode(blockType: string): void {
  delete CUSTOM_NODES[blockType];
}

/**
 * Instantiate the correct node handler for a block.
 * Checks custom nodes first, then falls back to built-in types.
 * Unknown types get PassthroughNode.
 */
export function getNodeHandler(block: BlockDef): SDKBaseNode {
  if (block.type in CUSTOM_NODES) {
    return new CUSTOM_NODES[block.type](block);
  }
  const Cls = BUILTIN_HANDLERS[block.type] ?? PassthroughNode;
  return new Cls(block);
}

export { SDKBaseNode as SDKBaseNodeClass };
