/**
 * Web Search BYOK demo — Tavily direct call
 *
 * Usage:
 *   TAVILY_API_KEY=tvly-xxx npx tsx examples/web-search-demo.ts
 */

import { WebSearch } from "../src/agent/web-search.js";

const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) {
  console.error("TAVILY_API_KEY not set");
  process.exit(1);
}

const ws = new WebSearch({
  provider: "tavily",
  providerApiKey: apiKey,
  maxResults: 3,
});

// 1) Direct search
console.log("--- Direct search ---");
const results = await ws.search("Schift AI agent framework 2026");
for (const r of results) {
  console.log(`  ${r.title}`);
  console.log(`  ${r.url}`);
  console.log(`  ${r.snippet.slice(0, 120)}...`);
  console.log();
}

// 2) As agent tool
console.log("--- asTool() handler ---");
const tool = ws.asTool();
console.log(`Tool name: ${tool.name}`);
const toolResult = await tool.handler({ query: "AI regulations Korea 2026" });
console.log(`Success: ${toolResult.success}`);
if (toolResult.success && Array.isArray(toolResult.data)) {
  console.log(`Results: ${toolResult.data.length}`);
  for (const r of toolResult.data as Array<{ title: string; url: string }>) {
    console.log(`  - ${r.title} (${r.url})`);
  }
}
