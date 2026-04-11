import type { RAGConfig, AgentTool, ToolResult } from "./types.js";

/** Transport interface matching Schift client's internal HTTP methods. */
interface Transport {
  post: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
}

interface SearchResultItem {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface ChatResult {
  answer: string;
  sources: Array<{ text: string; metadata?: Record<string, unknown> }>;
}

/**
 * RAG -- Schift's killer primitive.
 *
 * Wraps a Schift Cloud bucket with high-level search and chat methods.
 * All document processing (OCR, chunking, embedding, reranking) is handled
 * by Schift Cloud.
 */
export class RAG {
  readonly bucket: string;
  private readonly topK: number;
  private readonly transport: Transport;

  constructor(config: RAGConfig, transport: Transport) {
    this.bucket = config.bucket;
    this.topK = config.topK ?? 7;
    this.transport = transport;
  }

  /** Maximum query length in characters (embedding models typically cap at ~8K tokens). */
  static readonly MAX_QUERY_LENGTH = 8000;

  /** Semantic search over the bucket's documents. */
  async search(query: string): Promise<SearchResultItem[]> {
    if (query.length > RAG.MAX_QUERY_LENGTH) {
      query = query.slice(0, RAG.MAX_QUERY_LENGTH);
    }
    const resp = await this.transport.post<{ results: SearchResultItem[] }>(
      `/v1/buckets/${this.bucket}/search`,
      { query, top_k: this.topK },
    );
    return resp.results;
  }

  /** RAG chat -- search + LLM answer in one call. */
  async chat(query: string): Promise<ChatResult> {
    return this.transport.post<ChatResult>("/v1/chat", {
      query,
      bucket_id: this.bucket,
      top_k: this.topK,
    });
  }

  /** Return this RAG instance as an AgentTool for use in agents. */
  asTool(name?: string): AgentTool {
    return {
      name: name ?? "rag_search",
      description: `Semantic search over documents in the "${this.bucket}" knowledge base. Returns relevant passages with scores.`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
      handler: async (args): Promise<ToolResult> => {
        const query = String(args.query ?? "");
        const results = await this.search(query);
        return {
          success: true,
          data: results.map((r) => ({ text: r.text, score: r.score })),
        };
      },
    };
  }
}
