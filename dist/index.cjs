"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AuthError: () => AuthError,
  BlockRunStatus: () => BlockRunStatus,
  BlockType: () => BlockType,
  QuotaError: () => QuotaError,
  RunStatus: () => RunStatus,
  Schift: () => Schift,
  SchiftError: () => SchiftError,
  WorkflowBuilder: () => WorkflowBuilder,
  WorkflowClient: () => WorkflowClient,
  WorkflowStatus: () => WorkflowStatus,
  WorkflowTemplate: () => WorkflowTemplate
});
module.exports = __toCommonJS(src_exports);

// src/errors.ts
var SchiftError = class extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "SchiftError";
    this.status = status;
    this.code = code;
  }
};
var AuthError = class extends SchiftError {
  constructor(message = "Invalid API key") {
    super(message, 401, "auth_error");
    this.name = "AuthError";
  }
};
var QuotaError = class extends SchiftError {
  constructor(message = "Quota exceeded") {
    super(message, 402, "quota_exceeded");
    this.name = "QuotaError";
  }
};

// src/workflow/client.ts
var BASE = "/v1/workflows";
function toBody(obj) {
  return obj;
}
var WorkflowClient = class {
  http;
  constructor(http) {
    this.http = http;
  }
  // ---- CRUD ----
  /**
   * Create a new workflow.
   */
  async create(request) {
    return this.http.post(BASE, toBody(request));
  }
  /**
   * List all workflows in the current project/org.
   */
  async list() {
    const resp = await this.http.get(BASE);
    return resp.workflows;
  }
  /**
   * Get a single workflow by ID.
   */
  async get(workflowId) {
    return this.http.get(`${BASE}/${workflowId}`);
  }
  /**
   * Update a workflow (name, description, status, or full graph).
   */
  async update(workflowId, request) {
    return this.http.patch(
      `${BASE}/${workflowId}`,
      toBody(request)
    );
  }
  /**
   * Delete a workflow.
   */
  async delete(workflowId) {
    return this.http.delete(`${BASE}/${workflowId}`);
  }
  // ---- Blocks ----
  /**
   * Add a block to a workflow.
   */
  async addBlock(workflowId, request) {
    return this.http.post(
      `${BASE}/${workflowId}/blocks`,
      toBody(request)
    );
  }
  /**
   * Remove a block from a workflow.
   */
  async removeBlock(workflowId, blockId) {
    return this.http.delete(`${BASE}/${workflowId}/blocks/${blockId}`);
  }
  // ---- Edges ----
  /**
   * Add an edge between two blocks.
   */
  async addEdge(workflowId, request) {
    return this.http.post(
      `${BASE}/${workflowId}/edges`,
      toBody(request)
    );
  }
  /**
   * Remove an edge from a workflow.
   */
  async removeEdge(workflowId, edgeId) {
    return this.http.delete(`${BASE}/${workflowId}/edges/${edgeId}`);
  }
  // ---- Execution ----
  /**
   * Execute a workflow with optional inputs.
   */
  async run(workflowId, inputs) {
    const body = { inputs };
    return this.http.post(
      `${BASE}/${workflowId}/run`,
      toBody(body)
    );
  }
  /**
   * Validate a workflow graph (checks for cycles, missing connections, etc.).
   */
  async validate(workflowId) {
    return this.http.post(
      `${BASE}/${workflowId}/validate`,
      {}
    );
  }
  // ---- Meta ----
  /**
   * List all available block types with their schemas.
   */
  async getBlockTypes() {
    const resp = await this.http.get(
      `${BASE}/meta/block-types`
    );
    return resp.block_types;
  }
  /**
   * List available workflow templates.
   */
  async getTemplates() {
    const resp = await this.http.get(
      `${BASE}/meta/templates`
    );
    return resp.templates;
  }
};

// src/client.ts
var DEFAULT_BASE_URL = "https://api.schift.io";
var DEFAULT_TIMEOUT = 6e4;
var VERSION = "0.1.0";
var Schift = class {
  apiKey;
  baseUrl;
  timeout;
  /**
   * Workflow sub-client for building and running RAG pipelines.
   *
   * @example
   * ```ts
   * const wf = await client.workflows.create({ name: "My RAG" });
   * const run = await client.workflows.run(wf.id, { query: "hello" });
   * ```
   */
  workflows;
  /**
   * DB sub-module for bucket and document management.
   *
   * @example
   * ```ts
   * const result = await client.db.upload("my-docs", {
   *   files: [new File([pdfBytes], "manual.pdf")],
   * });
   * ```
   */
  db;
  constructor(config) {
    if (!config.apiKey?.startsWith("sch_")) {
      throw new SchiftError("Invalid API key. Keys start with 'sch_'");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const transport = {
      get: (path) => this.get(path),
      post: (path, body) => this.post(path, body),
      patch: (path, body) => this.patch(path, body),
      delete: (path) => this.del(path)
    };
    this.workflows = new WorkflowClient(transport);
    this.db = {
      upload: this._dbUpload.bind(this)
    };
  }
  // ---- Embeddings ----
  /** Embed a single text string. */
  async embed(request) {
    return this.post("/v1/embed", {
      text: request.text,
      model: request.model,
      dimensions: request.dimensions
    });
  }
  /** Embed multiple texts in a single request. */
  async embedBatch(request) {
    return this.post("/v1/embed/batch", {
      texts: request.texts,
      model: request.model,
      dimensions: request.dimensions
    });
  }
  // ---- Search ----
  async search(request) {
    return this.post("/v1/query", {
      query: request.query,
      collection: request.collection,
      top_k: request.topK
    });
  }
  // ---- RAG Chat ----
  /**
   * RAG Chat — search bucket + generate answer in one call.
   *
   * @example
   * ```ts
   * const result = await client.chat({
   *   bucketId: "my-bucket",
   *   message: "how do I reset my password?",
   * });
   * console.log(result.reply, result.sources);
   * ```
   */
  async chat(request) {
    return this.post("/v1/chat", {
      bucket_id: request.bucketId,
      message: request.message,
      history: request.history,
      model: request.model,
      top_k: request.topK,
      stream: false,
      system_prompt: request.systemPrompt,
      temperature: request.temperature,
      max_tokens: request.maxTokens
    });
  }
  /**
   * RAG Chat with SSE streaming.
   * Returns an async iterator of ChatStreamEvent.
   *
   * @example
   * ```ts
   * for await (const event of client.chatStream({
   *   bucketId: "my-bucket",
   *   message: "summarize the Q4 report",
   * })) {
   *   if (event.type === "sources") console.log(event.sources);
   *   if (event.type === "chunk") process.stdout.write(event.content ?? "");
   *   if (event.type === "done") console.log("\n--- done ---");
   * }
   * ```
   */
  async *chatStream(request) {
    const url = `${this.baseUrl}/v1/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-ts/${VERSION}`
      },
      body: JSON.stringify({
        bucket_id: request.bucketId,
        message: request.message,
        history: request.history,
        model: request.model,
        top_k: request.topK,
        stream: true,
        system_prompt: request.systemPrompt,
        temperature: request.temperature,
        max_tokens: request.maxTokens
      }),
      signal: AbortSignal.timeout(this.timeout)
    });
    if (!res.ok) {
      await this.throwError(res);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new SchiftError("No response body", 500);
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data);
        } catch {
        }
      }
    }
  }
  // ---- Model Routing (Projection) ----
  /**
   * @deprecated Not yet available on the server.
   * Use the Python SDK for projection until this endpoint is released.
   */
  async project(_request) {
    throw new SchiftError(
      "project() is not yet available. Use the Python SDK for projection.",
      501
    );
  }
  // ---- DB / Buckets ----
  /**
   * Upload files to a named bucket. Creates the bucket if it does not exist.
   *
   * @example
   * ```ts
   * const result = await client.db.upload("my-docs", {
   *   files: [new File([pdfBytes], "manual.pdf", { type: "application/pdf" })],
   * });
   * console.log(result.bucket_id, result.uploaded);
   * ```
   */
  async _dbUpload(bucket, options) {
    const buckets = await this.get("/v1/buckets");
    const existing = buckets.find((b) => b.name === bucket);
    let bucketId;
    if (existing) {
      bucketId = existing.id;
    } else {
      const created = await this.post("/v1/buckets", { name: bucket });
      bucketId = created.id;
    }
    const uploaded = [];
    for (const file of options.files) {
      const form = new FormData();
      form.append("files", file);
      const resp = await fetch(`${this.baseUrl}/v1/buckets/${bucketId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": `schift-js/${VERSION}`
          // Do NOT set Content-Type — fetch sets it automatically with boundary
        },
        body: form,
        signal: AbortSignal.timeout(this.timeout)
      });
      if (!resp.ok) {
        await this.throwError(resp);
      }
      uploaded.push(await resp.json());
    }
    return { bucket_id: bucketId, bucket_name: bucket, uploaded };
  }
  // ---- Collections ----
  async listCollections() {
    return this.get("/v1/collections");
  }
  async getCollection(collectionId) {
    return this.get(`/v1/collections/${collectionId}`);
  }
  async deleteCollection(collectionId) {
    await this.del(`/v1/collections/${collectionId}`);
  }
  // ---- Files ----
  /**
   * @deprecated Not yet available on the server.
   */
  async uploadFile(_file, _filename) {
    throw new SchiftError(
      "uploadFile() is not yet available on the server.",
      501
    );
  }
  /**
   * @deprecated Not yet available on the server.
   */
  async getFile(_fileId) {
    throw new SchiftError(
      "getFile() is not yet available on the server.",
      501
    );
  }
  /**
   * @deprecated Not yet available on the server.
   */
  async deleteFile(_fileId) {
    throw new SchiftError(
      "deleteFile() is not yet available on the server.",
      501
    );
  }
  // ---- HTTP layer ----
  async post(path, body) {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-js/${VERSION}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout)
    });
    return this.handleResponse(resp);
  }
  async get(path) {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": `schift-js/${VERSION}`
      },
      signal: AbortSignal.timeout(this.timeout)
    });
    return this.handleResponse(resp);
  }
  async patch(path, body) {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-js/${VERSION}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout)
    });
    return this.handleResponse(resp);
  }
  async del(path) {
    await this.request("DELETE", path);
  }
  async request(method, path) {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": `schift-js/${VERSION}`
      },
      signal: AbortSignal.timeout(this.timeout)
    });
    if (!resp.ok) {
      await this.throwError(resp);
    }
    return resp;
  }
  async handleResponse(resp) {
    if (!resp.ok) {
      await this.throwError(resp);
    }
    return resp.json();
  }
  async throwError(resp) {
    const text = await resp.text().catch(() => "");
    const detail = (() => {
      try {
        return JSON.parse(text).detail;
      } catch {
        return text;
      }
    })();
    if (resp.status === 401) throw new AuthError(detail);
    if (resp.status === 402) throw new QuotaError(detail);
    throw new SchiftError(
      `API error ${resp.status}: ${detail}`,
      resp.status
    );
  }
};

// src/workflow/builder.ts
var WorkflowBuilder = class {
  _name;
  _description;
  _blocks = /* @__PURE__ */ new Map();
  _edges = [];
  _autoX = 0;
  _autoY = 0;
  _edgeCounter = 0;
  constructor(name) {
    this._name = name;
    this._description = "";
  }
  /**
   * Set the workflow description.
   */
  description(desc) {
    this._description = desc;
    return this;
  }
  /**
   * Add a block to the workflow.
   *
   * @param alias - A local identifier used for connecting blocks. This becomes
   *   the block's `id` in the built graph.
   * @param descriptor - Block type, optional title, position, and config.
   *   If `type` is omitted it defaults to the alias string (e.g. alias "start"
   *   maps to type "start").
   */
  addBlock(alias, descriptor = {}) {
    const blockType = descriptor.type ?? alias;
    const title = descriptor.title ?? alias;
    const position = descriptor.position ?? this.nextPosition();
    this._blocks.set(alias, {
      id: alias,
      type: blockType,
      title,
      position,
      config: descriptor.config ?? {}
    });
    return this;
  }
  /**
   * Connect two blocks with an edge.
   *
   * @param source - Alias of the source block.
   * @param target - Alias of the target block.
   * @param sourceHandle - Optional output handle name.
   * @param targetHandle - Optional input handle name.
   */
  connect(source, target, sourceHandle, targetHandle) {
    if (!this._blocks.has(source)) {
      throw new Error(
        `WorkflowBuilder: source block "${source}" not found. Add it with .addBlock("${source}", ...) first.`
      );
    }
    if (!this._blocks.has(target)) {
      throw new Error(
        `WorkflowBuilder: target block "${target}" not found. Add it with .addBlock("${target}", ...) first.`
      );
    }
    this._edgeCounter++;
    const edge = {
      id: `edge_${this._edgeCounter}`,
      source,
      target
    };
    if (sourceHandle) edge.source_handle = sourceHandle;
    if (targetHandle) edge.target_handle = targetHandle;
    this._edges.push(edge);
    return this;
  }
  /**
   * Return the constructed graph without the name/description wrapper.
   */
  buildGraph() {
    return {
      blocks: Array.from(this._blocks.values()),
      edges: [...this._edges]
    };
  }
  /**
   * Build a CreateWorkflowRequest ready to pass to `WorkflowClient.create()`.
   */
  build() {
    return {
      name: this._name,
      description: this._description || void 0,
      graph: this.buildGraph()
    };
  }
  // ---- internal helpers ----
  nextPosition() {
    const pos = { x: this._autoX, y: this._autoY };
    this._autoY += 120;
    return pos;
  }
};

// src/workflow/types.ts
var BlockType = {
  START: "start",
  END: "end",
  DOCUMENT_LOADER: "document_loader",
  DOCUMENT_PARSER: "document_parser",
  CHUNKER: "chunker",
  EMBEDDER: "embedder",
  MODEL_SELECTOR: "model_selector",
  VECTOR_STORE: "vector_store",
  COLLECTION: "collection",
  RETRIEVER: "retriever",
  RERANKER: "reranker",
  LLM: "llm",
  PROMPT_TEMPLATE: "prompt_template",
  CONDITION: "condition",
  ROUTER: "router",
  AI_ROUTER: "ai_router",
  LOOP: "loop",
  CODE: "code",
  MERGE: "merge",
  VARIABLE: "variable",
  FIELD_SELECTOR: "field_selector",
  HTTP_REQUEST: "http_request",
  WEBHOOK: "webhook",
  ANSWER: "answer",
  METADATA_EXTRACTOR: "metadata_extractor"
};
var WorkflowStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived"
};
var RunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled"
};
var WorkflowTemplate = {
  BASIC_RAG: "basic_rag",
  DOCUMENT_QA: "document_qa",
  CONVERSATIONAL_RAG: "conversational_rag",
  MULTI_SOURCE_RAG: "multi_source_rag",
  AGENTIC_RAG: "agentic_rag"
};
var BlockRunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthError,
  BlockRunStatus,
  BlockType,
  QuotaError,
  RunStatus,
  Schift,
  SchiftError,
  WorkflowBuilder,
  WorkflowClient,
  WorkflowStatus,
  WorkflowTemplate
});
//# sourceMappingURL=index.cjs.map