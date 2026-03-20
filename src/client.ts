import { AuthError, QuotaError, SchiftError } from "./errors.js";
import type {
  SchiftConfig,
  EmbedRequest,
  EmbedResponse,
  EmbedBatchRequest,
  EmbedBatchResponse,
  SearchRequest,
  SearchResult,
  ProjectRequest,
  ProjectResponse,
  FileUploadResponse,
  BucketUploadResult,
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
} from "./types.js";
import { WorkflowClient } from "./workflow/client.js";
import type { HttpTransport } from "./workflow/client.js";

const DEFAULT_BASE_URL = "https://api.schift.io";
const DEFAULT_TIMEOUT = 60_000;
const VERSION = "0.1.0";

export class Schift {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  /**
   * Workflow sub-client for building and running RAG pipelines.
   *
   * @example
   * ```ts
   * const wf = await client.workflows.create({ name: "My RAG" });
   * const run = await client.workflows.run(wf.id, { query: "hello" });
   * ```
   */
  readonly workflows: WorkflowClient;

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
  readonly db: {
    upload(bucket: string, options: { files: File[] | Blob[] }): Promise<BucketUploadResult>;
  };

  constructor(config: SchiftConfig) {
    if (!config.apiKey?.startsWith("sch_")) {
      throw new SchiftError("Invalid API key. Keys start with 'sch_'");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;

    const transport: HttpTransport = {
      get: <T>(path: string) => this.get<T>(path),
      post: <T>(path: string, body: Record<string, unknown>) =>
        this.post<T>(path, body),
      patch: <T>(path: string, body: Record<string, unknown>) =>
        this.patch<T>(path, body),
      delete: (path: string) => this.del(path),
    };

    this.workflows = new WorkflowClient(transport);

    // db sub-module — bind `this` so private helpers remain accessible
    this.db = {
      upload: this._dbUpload.bind(this),
    };
  }

  // ---- Embeddings ----

  /** Embed a single text string. */
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    return this.post("/v1/embed", {
      text: request.text,
      model: request.model,
      dimensions: request.dimensions,
    });
  }

  /** Embed multiple texts in a single request. */
  async embedBatch(request: EmbedBatchRequest): Promise<EmbedBatchResponse> {
    return this.post("/v1/embed/batch", {
      texts: request.texts,
      model: request.model,
      dimensions: request.dimensions,
    });
  }

  // ---- Search ----

  async search(request: SearchRequest): Promise<SearchResult[]> {
    return this.post<SearchResult[]>("/v1/query", {
      query: request.query,
      collection: request.collection,
      top_k: request.topK,
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
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.post<ChatResponse>("/v1/chat", {
      bucket_id: request.bucketId,
      message: request.message,
      history: request.history,
      model: request.model,
      top_k: request.topK,
      stream: false,
      system_prompt: request.systemPrompt,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
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
  async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamEvent> {
    const url = `${this.baseUrl}/v1/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-ts/${VERSION}`,
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
        max_tokens: request.maxTokens,
      }),
      signal: AbortSignal.timeout(this.timeout),
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
          yield JSON.parse(data) as ChatStreamEvent;
        } catch {
          // skip malformed
        }
      }
    }
  }

  // ---- Model Routing (Projection) ----

  /**
   * @deprecated Not yet available on the server.
   * Use the Python SDK for projection until this endpoint is released.
   */
  async project(_request: ProjectRequest): Promise<ProjectResponse> {
    throw new SchiftError(
      "project() is not yet available. Use the Python SDK for projection.",
      501,
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
  private async _dbUpload(
    bucket: string,
    options: { files: File[] | Blob[] },
  ): Promise<BucketUploadResult> {
    // 1. Get or create bucket
    const buckets = await this.get<Array<{ id: string; name: string }>>("/v1/buckets");
    const existing = buckets.find((b) => b.name === bucket);
    let bucketId: string;
    if (existing) {
      bucketId = existing.id;
    } else {
      const created = await this.post<{ id: string }>("/v1/buckets", { name: bucket });
      bucketId = created.id;
    }

    // 2. Upload each file via multipart/form-data
    const uploaded: unknown[] = [];
    for (const file of options.files) {
      const form = new FormData();
      form.append("files", file);

      const resp = await fetch(`${this.baseUrl}/v1/buckets/${bucketId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": `schift-js/${VERSION}`,
          // Do NOT set Content-Type — fetch sets it automatically with boundary
        },
        body: form,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!resp.ok) {
        await this.throwError(resp);
      }

      uploaded.push(await resp.json());
    }

    return { bucket_id: bucketId, bucket_name: bucket, uploaded };
  }

  // ---- Collections ----

  async listCollections(): Promise<any[]> {
    return this.get<any[]>("/v1/collections");
  }

  async getCollection(collectionId: string): Promise<any> {
    return this.get<any>(`/v1/collections/${collectionId}`);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.del(`/v1/collections/${collectionId}`);
  }

  // ---- Files ----

  /**
   * @deprecated Not yet available on the server.
   */
  async uploadFile(
    _file: Blob,
    _filename: string,
  ): Promise<FileUploadResponse> {
    throw new SchiftError(
      "uploadFile() is not yet available on the server.",
      501,
    );
  }

  /**
   * @deprecated Not yet available on the server.
   */
  async getFile(_fileId: string): Promise<FileUploadResponse> {
    throw new SchiftError(
      "getFile() is not yet available on the server.",
      501,
    );
  }

  /**
   * @deprecated Not yet available on the server.
   */
  async deleteFile(_fileId: string): Promise<void> {
    throw new SchiftError(
      "deleteFile() is not yet available on the server.",
      501,
    );
  }

  // ---- HTTP layer ----

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-js/${VERSION}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse(resp);
  }

  private async get<T>(path: string): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": `schift-js/${VERSION}`,
      },
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse(resp);
  }

  private async patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `schift-js/${VERSION}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse(resp);
  }

  private async del(path: string): Promise<void> {
    await this.request("DELETE", path);
  }

  private async request(method: string, path: string): Promise<Response> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": `schift-js/${VERSION}`,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      await this.throwError(resp);
    }
    return resp;
  }

  private async handleResponse<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
      await this.throwError(resp);
    }
    return resp.json() as Promise<T>;
  }

  private async throwError(resp: Response): Promise<never> {
    const text = await resp.text().catch(() => "");
    const detail = (() => {
      try { return JSON.parse(text).detail; } catch { return text; }
    })();

    if (resp.status === 401) throw new AuthError(detail);
    if (resp.status === 402) throw new QuotaError(detail);
    throw new SchiftError(
      `API error ${resp.status}: ${detail}`,
      resp.status,
    );
  }
}
