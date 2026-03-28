import type { AgentTool, ToolResult, WebSearchConfig, WebSearchProvider, WebSearchResultItem } from "./types.js";
import { searchTavily, searchSerper, searchBrave } from "./web-search-providers.js";

/** Transport interface matching Schift client's internal HTTP methods. */
interface Transport {
  post: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
}

/**
 * WebSearch -- real-time web search for AI agents.
 *
 * Supports two modes:
 * - **Schift Cloud** (default): proxied through `/v1/web-search`, billed on the web search usage axis
 * - **BYOK**: call Tavily/Serper/Brave directly with your own API key
 *
 * Use Schift Cloud when you want one API key and unified billing. Use BYOK when
 * you want to route web search directly to Tavily, Serper, or Brave.
 *
 * @example Schift Cloud
 * ```ts
 * const schift = new Schift({ apiKey: "sch_xxx" });
 * const webSearch = new WebSearch({ provider: "schift" }, schift.transport);
 * const results = await webSearch.search("latest AI regulations 2026");
 * ```
 *
 * @example BYOK (Tavily)
 * ```ts
 * const webSearch = new WebSearch({
 *   provider: "tavily",
 *   providerApiKey: "tvly-xxx",
 * });
 * const results = await webSearch.search("latest AI regulations 2026");
 * ```
 *
 * @example As agent tool
 * ```ts
 * const agent = new Agent({
 *   name: "researcher",
 *   instructions: "You are a research assistant.",
 *   tools: [webSearch.asTool()],
 * });
 * ```
 */
export class WebSearch {
  private readonly maxResults: number;
  private readonly provider: WebSearchProvider;
  private readonly providerApiKey: string;
  private readonly transport: Transport | null;

  constructor(config?: WebSearchConfig, transport?: Transport) {
    this.maxResults = config?.maxResults ?? 5;
    this.provider = config?.provider ?? "schift";
    this.providerApiKey = config?.providerApiKey ?? "";
    this.transport = transport ?? null;

    if (this.provider === "schift" && !this.transport) {
      throw new Error(
        'WebSearch with provider "schift" requires a transport. ' +
          "Pass schift.transport, or use a BYOK provider (tavily, serper, brave).",
      );
    }
    if (this.provider !== "schift" && !this.providerApiKey) {
      throw new Error(
        `WebSearch with provider "${this.provider}" requires providerApiKey.`,
      );
    }
  }

  /** Search the web. Routes to Schift Cloud or BYOK provider based on config. */
  async search(query: string): Promise<WebSearchResultItem[]> {
    switch (this.provider) {
      case "schift":
        return this.searchSchift(query);
      case "tavily":
        return searchTavily(query, this.maxResults, this.providerApiKey);
      case "serper":
        return searchSerper(query, this.maxResults, this.providerApiKey);
      case "brave":
        return searchBrave(query, this.maxResults, this.providerApiKey);
      default:
        throw new Error(`Unknown web search provider: ${this.provider}`);
    }
  }

  /** Return this WebSearch instance as an AgentTool for use in agents. */
  asTool(name?: string): AgentTool {
    return {
      name: name ?? "web_search",
      description:
        "Search the web for real-time information. Returns titles, URLs, and snippets from relevant web pages. Use when the question requires up-to-date information not available in the knowledge base.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The web search query" },
        },
        required: ["query"],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const query = String(args.query ?? "");
          const results = await this.search(query);
          return {
            success: true,
            data: results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
            })),
          };
        } catch (err) {
          return {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    };
  }

  private async searchSchift(query: string): Promise<WebSearchResultItem[]> {
    const resp = await this.transport!.post<{ results: WebSearchResultItem[] }>(
      "/v1/web-search",
      { query, max_results: this.maxResults },
    );
    return resp.results;
  }
}
