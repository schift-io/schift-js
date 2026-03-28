/**
 * Deep Research Agent Template
 *
 * Flow:
 *   Question → WebSearch → LLM analyze → sufficient?
 *     → NO:  refine query, store partial results, loop (max N iterations)
 *     → YES: synthesize final report with sources
 *
 * Usage:
 *   TAVILY_API_KEY=tvly-xxx OPENAI_API_KEY=sk-xxx npx tsx examples/deep-research.ts "AI agent framework trends 2026"
 *
 * Or with Schift Cloud (routes LLM via Schift):
 *   TAVILY_API_KEY=tvly-xxx SCHIFT_API_KEY=sch_xxx npx tsx examples/deep-research.ts "query"
 */

import { WebSearch } from "../src/agent/web-search.js";
import type { WebSearchResultItem } from "../src/agent/types.js";

// ---- Config ----

const MAX_ITERATIONS = 3;
const RESULTS_PER_SEARCH = 5;

const tavilyKey = process.env.TAVILY_API_KEY;
if (!tavilyKey) {
  console.error("TAVILY_API_KEY required");
  process.exit(1);
}

const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.error("OPENAI_API_KEY required (used for LLM analysis)");
  process.exit(1);
}

const question = process.argv[2];
if (!question) {
  console.error("Usage: npx tsx examples/deep-research.ts \"your question\"");
  process.exit(1);
}

// ---- LLM helper (direct OpenAI call for standalone demo) ----

async function llmCall(systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}

// ---- Deep Research Loop ----

interface ResearchState {
  question: string;
  queries: string[];
  allResults: WebSearchResultItem[];
  iteration: number;
}

const ws = new WebSearch({
  provider: "tavily",
  providerApiKey: tavilyKey,
  maxResults: RESULTS_PER_SEARCH,
});

async function generateSearchQueries(state: ResearchState): Promise<string[]> {
  const prompt = state.iteration === 0
    ? `Generate 2 diverse search queries to research this question. Return only the queries, one per line, no numbering.\n\nQuestion: ${state.question}`
    : `Based on what we found so far, generate 2 follow-up search queries to fill knowledge gaps.\n\nOriginal question: ${state.question}\n\nPrevious queries: ${state.queries.join("; ")}\n\nResults so far:\n${state.allResults.map((r) => `- ${r.title}: ${r.snippet.slice(0, 100)}`).join("\n")}\n\nReturn only the queries, one per line, no numbering.`;

  const raw = await llmCall(
    "You are a research query generator. Output only search queries, one per line.",
    prompt,
  );
  return raw.split("\n").map((q) => q.trim()).filter((q) => q.length > 0).slice(0, 2);
}

async function evaluateSufficiency(state: ResearchState): Promise<{ sufficient: boolean; reason: string }> {
  const resultsText = state.allResults
    .map((r) => `[${r.title}](${r.url})\n${r.snippet}`)
    .join("\n\n");

  const raw = await llmCall(
    "You evaluate whether collected research is sufficient to answer a question comprehensively. Respond in JSON: {\"sufficient\": true/false, \"reason\": \"...\"}",
    `Question: ${state.question}\n\nCollected results (${state.allResults.length} items):\n${resultsText}`,
  );

  try {
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { sufficient: false, reason: "Failed to parse evaluation" };
  }
}

async function synthesizeReport(state: ResearchState): Promise<string> {
  const resultsText = state.allResults
    .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
    .join("\n\n");

  return llmCall(
    "You are a research analyst. Synthesize the collected search results into a comprehensive, well-structured report. Include source citations as [n] references. Write in the same language as the question.",
    `Question: ${state.question}\n\nSources:\n${resultsText}`,
  );
}

// ---- Main ----

async function deepResearch(question: string): Promise<string> {
  const state: ResearchState = {
    question,
    queries: [],
    allResults: [],
    iteration: 0,
  };

  console.log(`\n[Deep Research] "${question}"\n`);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    state.iteration = i;
    console.log(`--- Iteration ${i + 1}/${MAX_ITERATIONS} ---`);

    // 1. Generate search queries
    const queries = await generateSearchQueries(state);
    console.log(`  Queries: ${queries.join(" | ")}`);
    state.queries.push(...queries);

    // 2. Search
    for (const q of queries) {
      const results = await ws.search(q);
      console.log(`  "${q}" -> ${results.length} results`);

      // Deduplicate by URL
      for (const r of results) {
        if (!state.allResults.some((existing) => existing.url === r.url)) {
          state.allResults.push(r);
        }
      }
    }
    console.log(`  Total unique results: ${state.allResults.length}`);

    // 3. Evaluate sufficiency
    const evaluation = await evaluateSufficiency(state);
    console.log(`  Sufficient: ${evaluation.sufficient} (${evaluation.reason})`);

    if (evaluation.sufficient) {
      break;
    }
  }

  // 4. Synthesize final report
  console.log(`\n--- Synthesizing report from ${state.allResults.length} sources ---\n`);
  const report = await synthesizeReport(state);
  return report;
}

const report = await deepResearch(question);
console.log(report);
