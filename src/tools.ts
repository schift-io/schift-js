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

import type { SearchRequest, SearchResult, ChatRequest, ChatResponse } from "./types.js";

// ---- Tool definitions per provider ----

interface SchiftToolsConfig {
  /** Default collection/bucket for search (can be overridden per call). */
  collection?: string;
  bucketId?: string;
  /** Number of results to return. Default 5. */
  topK?: number;
  /** Include RAG chat tool alongside search. Default false. */
  includeChat?: boolean;
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

type SearchFn = (req: SearchRequest) => Promise<SearchResult[]>;
type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;

export class SchiftTools {
  private readonly searchFn: SearchFn;
  private readonly chatFn: ChatFn;
  private readonly config: Required<SchiftToolsConfig>;

  constructor(
    searchFn: SearchFn,
    chatFn: ChatFn,
    config: SchiftToolsConfig = {},
  ) {
    this.searchFn = searchFn;
    this.chatFn = chatFn;
    this.config = {
      collection: config.collection ?? "",
      bucketId: config.bucketId ?? "",
      topK: config.topK ?? 5,
      includeChat: config.includeChat ?? false,
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
                ...(this.config.bucketId
                  ? { default: this.config.bucketId }
                  : {}),
              },
            },
            required: ["message"],
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
      args = (toolCall as Record<string, unknown>).input as Record<string, unknown> ?? {};
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

    throw new Error(`Unknown tool: ${name}`);
  }

  // ---- Internal ----

  private async _execSearch(
    args: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    return this.searchFn({
      query: args.query as string,
      collection:
        (args.collection as string) || this.config.collection,
      topK: (args.top_k as number) || this.config.topK,
    });
  }

  private async _execChat(
    args: Record<string, unknown>,
  ): Promise<ChatResponse> {
    return this.chatFn({
      bucketId: (args.bucket_id as string) || this.config.bucketId,
      message: args.message as string,
    });
  }
}
