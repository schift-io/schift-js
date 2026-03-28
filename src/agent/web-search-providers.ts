/**
 * Shared BYOK web search provider implementations.
 * Used by both the agent WebSearch class and the workflow WebSearchNode.
 */

import type { WebSearchResultItem } from "./types.js";

export async function searchTavily(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<WebSearchResultItem[]> {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
  });
  if (!resp.ok) {
    throw new Error(`Tavily API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as {
    results: Array<{ title: string; url: string; content: string }>;
  };
  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
}

export async function searchSerper(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<WebSearchResultItem[]> {
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  if (!resp.ok) {
    throw new Error(`Serper API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as {
    organic: Array<{ title: string; link: string; snippet: string }>;
  };
  return (data.organic ?? []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
  }));
}

export async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<WebSearchResultItem[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(maxResults),
  });
  const resp = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    },
  );
  if (!resp.ok) {
    throw new Error(`Brave Search API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as {
    web?: { results: Array<{ title: string; url: string; description: string }> };
  };
  return (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}
