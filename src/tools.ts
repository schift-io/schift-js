/**
 * Tool Calling helpers — plug Schift search/chat into any LLM agent.
 *
 * @example OpenAI
 * ```ts
 * import OpenAI from "openai";
 * import { Schift } from "@schift-io/sdk";
 *
 * const schift = new Schift({ apiKey: "sch_xxx" });
 * const openai = new OpenAI();
 *
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o-mini",
 *   messages: [{ role: "user", content: "3조 위반 가능성?" }],
 *   tools: schift.tools.openai(),
 * });
 *
 * // When OpenAI calls the tool:
 * const toolResult = await schift.tools.handle(response.choices[0].message.tool_calls[0]);
 * ```
 *
 * @example Anthropic (Claude)
 * ```ts
 * import Anthropic from "@anthropic-ai/sdk";
 *
 * const response = await anthropic.messages.create({
 *   model: "claude-sonnet-4-20250514",
 *   tools: schift.tools.anthropic(),
 *   messages: [{ role: "user", content: "계약서에서 해지 조건 찾아줘" }],
 * });
 *
 * const toolResult = await schift.tools.handle(response.content[0]);
 * ```
 *
 * @example Vercel AI SDK
 * ```ts
 * import { generateText } from "ai";
 * const result = await generateText({
 *   model: openai("gpt-4o-mini"),
 *   tools: schift.tools.vercelAI(),
 *   prompt: "인보이스에서 총액 찾아줘",
 * });
 * ```
 */

import type {
  SearchRequest,
  SearchResult,
  ChatRequest,
  ChatResponse,
} from "./types.js";
import type { WebSearchResultItem } from "./agent/types.js";

// ---- Tool definitions per provider ----

interface SchiftToolsConfig {
  /** Default collection/bucket for search (can be overridden per call). */
  collection?: string;
  /** Bucket name or ID for RAG chat/search. Name recommended. */
  bucket?: string;
  /** @deprecated Use `bucket` instead. */
  bucketId?: string;
  /** Number of results to return. Default 5. */
  topK?: number;
  /** Include RAG chat tool alongside search. Default false. */
  includeChat?: boolean;
  /** Include web search tool. Default false. */
  includeWebSearch?: boolean;
  /** Max web search results. Default 5. */
  webSearchMaxResults?: number;
  /** Custom tool name prefix. Default "schift". */
  prefix?: string;
}

interface ToolCallInput {
  name?: string;
  function?: { name: string; arguments: string };
  // Anthropic format
  type?: string;
  input?: Record<string, unknown>;
}

interface WebSearchRequest {
  query: string;
  maxResults?: number;
}

type SearchFn = (req: SearchRequest) => Promise<SearchResult[]>;
type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;
type WebSearchFn = (req: WebSearchRequest) => Promise<WebSearchResultItem[]>;

export class SchiftTools {
  private readonly searchFn: SearchFn;
  private readonly chatFn: ChatFn;
  private readonly webSearchFn: WebSearchFn | null;
  private readonly config: Required<SchiftToolsConfig>;

  constructor(
    searchFn: SearchFn,
    chatFn: ChatFn,
    config: SchiftToolsConfig = {},
    webSearchFn?: WebSearchFn,
  ) {
    this.searchFn = searchFn;
    this.chatFn = chatFn;
    this.webSearchFn = webSearchFn ?? null;
    this.config = {
      collection: config.collection ?? "",
      bucket: config.bucket ?? config.bucketId ?? "",
      bucketId: config.bucket ?? config.bucketId ?? "",
      topK: config.topK ?? 5,
      includeChat: config.includeChat ?? false,
      includeWebSearch: config.includeWebSearch ?? false,
      webSearchMaxResults: config.webSearchMaxResults ?? 5,
      prefix: config.prefix ?? "schift",
    };
  }

  // ---- OpenAI format ----

  openai() {
    const tools: object[] = [
      {
        type: "function",
        function: {
          name: `${this.config.prefix}_search`,
          description:
            "Search through uploaded company documents. Returns relevant text passages with source citations and relevance scores.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query in natural language",
              },
              collection: {
                type: "string",
                description: "Document collection to search in",
                ...(this.config.collection
                  ? { default: this.config.collection }
                  : {}),
              },
              top_k: {
                type: "number",
                description: "Number of results to return (default 5)",
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    if (this.config.includeChat) {
      tools.push({
        type: "function",
        function: {
          name: `${this.config.prefix}_chat`,
          description:
            "Ask a question about uploaded documents and get an AI-generated answer with source citations.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The question to ask",
              },
              bucket_id: {
                type: "string",
                description: "Document bucket to search in",
                ...(this.config.bucket ? { default: this.config.bucket } : {}),
              },
            },
            required: ["message"],
          },
        },
      });
    }

    if (this.config.includeWebSearch) {
      tools.push({
        type: "function",
        function: {
          name: `${this.config.prefix}_web_search`,
          description:
            "Search the web for real-time information. Returns titles, URLs, and snippets from relevant web pages.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The web search query",
              },
              max_results: {
                type: "number",
                description: "Number of results to return (default 5)",
              },
            },
            required: ["query"],
          },
        },
      });
    }

    return tools;
  }

  // ---- Anthropic (Claude) format ----

  anthropic() {
    const tools: object[] = [
      {
        name: `${this.config.prefix}_search`,
        description:
          "Search through uploaded company documents. Returns relevant text passages with source citations and relevance scores.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query in natural language",
            },
            collection: {
              type: "string",
              description: "Document collection to search in",
            },
            top_k: {
              type: "number",
              description: "Number of results to return (default 5)",
            },
          },
          required: ["query"],
        },
      },
    ];

    if (this.config.includeChat) {
      tools.push({
        name: `${this.config.prefix}_chat`,
        description:
          "Ask a question about uploaded documents and get an AI-generated answer with source citations.",
        input_schema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The question to ask",
            },
            bucket_id: {
              type: "string",
              description: "Document bucket to search in",
            },
          },
          required: ["message"],
        },
      });
    }

    if (this.config.includeWebSearch) {
      tools.push({
        name: `${this.config.prefix}_web_search`,
        description:
          "Search the web for real-time information. Returns titles, URLs, and snippets from relevant web pages.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The web search query",
            },
            max_results: {
              type: "number",
              description: "Number of results to return (default 5)",
            },
          },
          required: ["query"],
        },
      });
    }

    return tools;
  }

  // ---- Vercel AI SDK format ----

  vercelAI() {
    const tools: Record<string, object> = {
      [`${this.config.prefix}_search`]: {
        description:
          "Search through uploaded company documents. Returns relevant text passages with source citations.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            collection: { type: "string", description: "Collection name" },
            top_k: { type: "number", description: "Number of results" },
          },
          required: ["query"],
        },
        execute: async (args: Record<string, unknown>) => {
          return this._execSearch(args);
        },
      },
    };

    if (this.config.includeChat) {
      tools[`${this.config.prefix}_chat`] = {
        description:
          "Ask a question about uploaded documents and get an AI-generated answer.",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "Question to ask" },
            bucket_id: { type: "string", description: "Bucket ID" },
          },
          required: ["message"],
        },
        execute: async (args: Record<string, unknown>) => {
          return this._execChat(args);
        },
      };
    }

    if (this.config.includeWebSearch) {
      tools[`${this.config.prefix}_web_search`] = {
        description:
          "Search the web for real-time information. Returns titles, URLs, and snippets.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Web search query" },
            max_results: { type: "number", description: "Number of results" },
          },
          required: ["query"],
        },
        execute: async (args: Record<string, unknown>) => {
          return this._execWebSearch(args);
        },
      };
    }

    return tools;
  }

  // ---- Universal handler ----

  /**
   * Handle a tool call from any provider (OpenAI, Anthropic, or raw).
   * Auto-detects the format and executes the search/chat.
   *
   * Returns a string ready to pass back as tool result.
   */
  async handle(toolCall: ToolCallInput): Promise<string> {
    let name: string;
    let args: Record<string, unknown>;

    // OpenAI format: { function: { name, arguments } }
    if (toolCall.function) {
      name = toolCall.function.name;
      args = JSON.parse(toolCall.function.arguments);
    }
    // Anthropic format: { type: "tool_use", name, input }
    else if (toolCall.type === "tool_use" && toolCall.name) {
      name = toolCall.name;
      args = toolCall.input ?? {};
    }
    // Raw: { name, input }
    else if (toolCall.name) {
      name = toolCall.name;
      args =
        ((toolCall as Record<string, unknown>).input as Record<
          string,
          unknown
        >) ?? {};
    } else {
      throw new Error("Unrecognized tool call format");
    }

    if (name === `${this.config.prefix}_search`) {
      const results = await this._execSearch(args);
      return JSON.stringify(results);
    }

    if (name === `${this.config.prefix}_chat`) {
      const result = await this._execChat(args);
      return JSON.stringify(result);
    }

    if (name === `${this.config.prefix}_web_search`) {
      const results = await this._execWebSearch(args);
      return JSON.stringify(results);
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  // ---- Internal ----

  private async _execSearch(
    args: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    return this.searchFn({
      query: args.query as string,
      collection: (args.collection as string) || this.config.collection,
      topK: (args.top_k as number) || this.config.topK,
    });
  }

  private async _execChat(
    args: Record<string, unknown>,
  ): Promise<ChatResponse> {
    const resolved =
      (args.bucket_id as string) || this.config.bucket || this.config.bucketId;
    return this.chatFn({
      bucketId: resolved,
      message: args.message as string,
    });
  }

  private async _execWebSearch(
    args: Record<string, unknown>,
  ): Promise<WebSearchResultItem[]> {
    if (!this.webSearchFn) {
      throw new Error(
        "WebSearch function not configured. Pass webSearchFn to SchiftTools constructor.",
      );
    }
    return this.webSearchFn({
      query: args.query as string,
      maxResults:
        (args.max_results as number) || this.config.webSearchMaxResults,
    });
  }
}
