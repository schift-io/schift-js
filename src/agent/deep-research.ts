import type {
  AgentTool,
  ToolResult,
  DeepResearchConfig,
  ResearchReport,
  WebSearchResultItem,
} from "./types.js";
import { WebSearch } from "./web-search.js";

/** Transport interface matching Schift client's internal HTTP methods. */
interface Transport {
  post: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
}

/** LLM call function — thin wrapper over any chat completions API. */
type LLMFn = (
  messages: Array<{ role: string; content: string }>,
) => Promise<string>;

/**
 * DeepResearch — iterative web research with automatic query refinement.
 *
 * Searches → evaluates sufficiency → refines queries → loops until
 * enough context is gathered, then synthesizes a final report.
 *
 * @example BYOK (standalone, no Schift Cloud)
 * ```ts
 * const research = new DeepResearch({
 *   webSearch: { provider: "tavily", providerApiKey: "tvly-xxx" },
 *   queryModel: "gpt-4o-mini",
 *   synthesisModel: "gpt-4o",
 *   maxIterations: 5,
 * }, llmFn);
 *
 * const report = await research.run("AI agent framework trends 2026");
 * console.log(report.answer);
 * console.log(`Sources: ${report.sources.length}`);
 * ```
 *
 * @example With Schift Cloud
 * ```ts
 * const research = new DeepResearch({
 *   synthesisModel: "gpt-4o",
 * }, llmFn, schift.transport);
 *
 * const report = await research.run("query");
 * ```
 *
 * @example As agent tool
 * ```ts
 * const agent = new Agent({
 *   tools: [research.asTool()],
 *   ...
 * });
 * ```
 */
export class DeepResearch {
  private readonly maxIterations: number;
  private readonly resultsPerSearch: number;
  private readonly queriesPerIteration: number;
  private readonly queryModel: string;
  private readonly synthesisModel: string;
  private readonly ws: WebSearch;
  private readonly llm: LLMFn;

  constructor(
    config: DeepResearchConfig = {},
    llm: LLMFn,
    transport?: Transport,
  ) {
    this.maxIterations = config.maxIterations ?? 3;
    this.resultsPerSearch = config.resultsPerSearch ?? 5;
    this.queriesPerIteration = config.queriesPerIteration ?? 2;
    this.queryModel = config.queryModel ?? "gpt-4o-mini";
    this.synthesisModel = config.synthesisModel ?? "gpt-4o-mini";
    this.llm = llm;

    this.ws = new WebSearch(
      {
        maxResults: this.resultsPerSearch,
        ...config.webSearch,
      },
      transport,
    );
  }

  /** Run iterative deep research on a question. */
  async run(question: string): Promise<ResearchReport> {
    const allResults: WebSearchResultItem[] = [];
    const allQueries: string[] = [];

    let iterations = 0;

    for (let i = 0; i < this.maxIterations; i++) {
      iterations = i + 1;

      // 1. Generate search queries (if LLM fails, stop iterating with what we have)
      let queries: string[];
      try {
        queries = await this.generateQueries(question, allQueries, allResults);
      } catch {
        break;
      }
      allQueries.push(...queries);

      // 2. Execute searches
      for (const q of queries) {
        try {
          const results = await this.ws.search(q);
          for (const r of results) {
            if (!allResults.some((existing) => existing.url === r.url)) {
              allResults.push(r);
            }
          }
        } catch {
          // Search failure for one query shouldn't kill the loop
        }
      }

      // 3. Evaluate sufficiency (skip on last iteration — synthesize anyway)
      if (i < this.maxIterations - 1) {
        try {
          const sufficient = await this.evaluateSufficiency(question, allResults);
          if (sufficient) break;
        } catch {
          break; // LLM down — synthesize with what we have
        }
      }
    }

    // 4. Synthesize (if no results gathered, return empty report)
    if (allResults.length === 0) {
      return { answer: "Research could not be completed — no results were gathered.", sources: [], iterations, totalQueries: allQueries.length };
    }
    let answer: string;
    try {
      answer = await this.synthesize(question, allResults);
    } catch {
      answer = `Research gathered ${allResults.length} sources but synthesis failed. Sources: ${allResults.map((r) => r.title).join(", ")}`;
    }

    return {
      answer,
      sources: allResults,
      iterations,
      totalQueries: allQueries.length,
    };
  }

  /** Return as an AgentTool for use inside an Agent's ReAct loop. */
  asTool(name?: string): AgentTool {
    return {
      name: name ?? "deep_research",
      description:
        "Perform iterative deep web research on a topic. Searches multiple times, refines queries, and produces a comprehensive report with sources. Use for questions that need thorough, multi-angle research.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The research question" },
        },
        required: ["query"],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const report = await this.run(String(args.query ?? ""));
          return {
            success: true,
            data: {
              answer: report.answer,
              sources: report.sources.map((s) => ({
                title: s.title,
                url: s.url,
              })),
              iterations: report.iterations,
            },
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

  // ---- Internal ----

  private async generateQueries(
    question: string,
    prevQueries: string[],
    prevResults: WebSearchResultItem[],
  ): Promise<string[]> {
    const isFirst = prevQueries.length === 0;
    const userPrompt = isFirst
      ? `Generate ${this.queriesPerIteration} diverse search queries to research this question. Return only the queries, one per line, no numbering.\n\nQuestion: ${question}`
      : `Generate ${this.queriesPerIteration} follow-up search queries to fill knowledge gaps.\n\nOriginal question: ${question}\n\nPrevious queries: ${prevQueries.join("; ")}\n\nResults so far:\n${prevResults.slice(-10).map((r) => `- ${r.title}: ${r.snippet.slice(0, 80)}`).join("\n")}\n\nReturn only the queries, one per line, no numbering.`;

    const raw = await this.llm([
      { role: "system", content: "You are a research query generator. Output only search queries, one per line." },
      { role: "user", content: userPrompt },
    ]);

    return raw
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, this.queriesPerIteration);
  }

  private async evaluateSufficiency(
    question: string,
    results: WebSearchResultItem[],
  ): Promise<boolean> {
    const summary = results
      .map((r) => `- ${r.title}: ${r.snippet.slice(0, 100)}`)
      .join("\n");

    const raw = await this.llm([
      {
        role: "system",
        content: 'Evaluate if collected research is sufficient. Respond ONLY "yes" or "no".',
      },
      {
        role: "user",
        content: `Question: ${question}\n\nCollected (${results.length} results):\n${summary}\n\nIs this sufficient for a comprehensive answer?`,
      },
    ]);

    return raw.trim().toLowerCase().startsWith("yes");
  }

  private async synthesize(
    question: string,
    results: WebSearchResultItem[],
  ): Promise<string> {
    const sources = results
      .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
      .join("\n\n");

    return this.llm([
      {
        role: "system",
        content: "You are a research analyst. Synthesize search results into a comprehensive report with source citations as [n]. Write in the same language as the question.",
      },
      {
        role: "user",
        content: `Question: ${question}\n\nSources:\n${sources}`,
      },
    ]);
  }
}
