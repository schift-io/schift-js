import { SDKBaseNode, maybeAwait, getEnvApiKey } from "./base.js";
import type { SDKExecutionContext } from "./base.js";
import { searchTavily, searchSerper, searchBrave } from "../../agent/web-search-providers.js";

/**
 * WebSearchNode -- workflow node for real-time web search.
 *
 * Config:
 *   provider: "schift" (default) | "tavily" | "serper" | "brave"
 *   max_results: number (default 5)
 *
 * When provider is "schift", delegates to ctx.client.webSearch().
 * When BYOK, calls the provider API directly using env var for API key:
 *   tavily  -> TAVILY_API_KEY
 *   serper  -> SERPER_API_KEY
 *   brave   -> BRAVE_API_KEY
 *
 * Input:  { query: string }
 * Output: { results: [{title, url, snippet}...], query: string }
 */
export class WebSearchNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const query = (inputs.query as string) ?? "";
    const maxResults = (this.config.max_results as number) ?? 5;
    const provider = (this.config.provider as string) ?? "schift";

    if (!query) {
      return { results: [], query };
    }

    if (provider === "schift") {
      if (!ctx.client) {
        throw new Error("WebSearchNode with provider 'schift' requires a Schift Client in the execution context");
      }
      const client = ctx.client as Record<string, (...args: unknown[]) => unknown>;
      const results = await maybeAwait(
        client.webSearch(query, maxResults) as Promise<
          { title: string; url: string; snippet: string }[]
        >,
      );
      return { results, query };
    }

    const apiKey = getEnvApiKey(provider);
    switch (provider) {
      case "tavily":
        return { results: await searchTavily(query, maxResults, apiKey), query };
      case "serper":
        return { results: await searchSerper(query, maxResults, apiKey), query };
      case "brave":
        return { results: await searchBrave(query, maxResults, apiKey), query };
      default:
        throw new Error(
          `Unknown web search provider '${provider}'. Supported: schift, tavily, serper, brave.`,
        );
    }
  }
}
