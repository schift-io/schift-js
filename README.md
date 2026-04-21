# @schift-io/sdk

Schift TypeScript SDK for bucket upload, vector search, and workflows.

## Install

```bash
npm install @schift-io/sdk
```

## Quick Start

```typescript
import { Schift } from "@schift-io/sdk";

const client = new Schift({ apiKey: "sch_your_api_key" });

// Create or reuse a bucket, upload a document, then search it.
// All bucket methods accept a name or ID — no need to track UUIDs.
await client.createBucket({ name: "company-docs" });
const file = new File([await readFile("manual.pdf")], "manual.pdf", {
  type: "application/pdf",
});
await client.db.upload("company-docs", { files: [file] });

const jobs = await client.listJobs({ bucket: "company-docs", limit: 5 });
const results = await client.bucketSearch("company-docs", {
  query: "refund policy",
  topK: 5,
});

console.log(jobs[0]?.status ?? "queued");
console.log(results[0]);
```

Use `search({ bucket: ... })` when you want raw bucket retrieval, `POST /v1/chat` for bucket-backed RAG chat with sources, and `POST /v1/chat/completions` for OpenAI-compatible LLM routing without bucket context.

## API Key

Get your API key from the [Schift Dashboard](https://schift.io/app) > API Keys.

You can also use environment variables:

```typescript
const client = new Schift({ apiKey: process.env.SCHIFT_API_KEY! });
```

## Features

### Embeddings

```typescript
// Single text
const resp = await client.embed({
  text: "Search query",
  model: "openai/text-embedding-3-small", // optional
  dimensions: 1024,                       // optional
});
// resp: { embedding: number[], model: string, dimensions: number, usage: { tokens: number } }

// Batch (up to 2048 texts)
const batch = await client.embedBatch({
  texts: ["doc 1", "doc 2", "doc 3"],
  model: "gemini/text-embedding-004",
});
// batch: { embeddings: number[][], model: string, dimensions: number, usage: { tokens, count } }
```

### Search

```typescript
const results = await client.search({
  query: "How does projection work?",
  bucket: "my-docs",
  topK: 10,
});
// results: Array<{ id, score, modality, metadata? }>
```

### Web Search

```typescript
// Schift Cloud web search
const results = await client.webSearch("latest AI regulations 2026", 5);
results.forEach((r) => {
  console.log(r.title, r.url);
});
```

```typescript
// BYOK provider for direct web search
import { WebSearch } from "@schift-io/sdk";

const webSearch = new WebSearch({
  provider: "tavily",
  providerApiKey: process.env.TAVILY_API_KEY!,
  maxResults: 5,
});

const fresh = await webSearch.search("Schift framework launch updates");
```

Tool calling helpers created from `client.tools` include `schift_web_search` by default, so OpenAI/Claude/Vercel AI SDK integrations can call live web search without extra wiring.

### Agent SDK Compatibility

Schift sits underneath the agent framework. The integration point is always the same:

1. let the agent call a Schift search tool
2. run retrieval against Schift buckets or buckets
3. return grounded chunks back to the model

That means you can keep your preferred agent SDK and swap only the retrieval layer.

### Google Gen AI SDK

```typescript
import { GoogleGenAI } from "@google/genai";
import { Schift } from "@schift-io/sdk";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const schift = new Schift({ apiKey: process.env.SCHIFT_API_KEY! });

const firstTurn = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What changed in the latest billing policy?",
  config: {
    tools: schift.tools.googleGenAI(),
  },
});

const functionCall = firstTurn.functionCalls?.[0];
if (functionCall) {
  const functionResponsePart = await schift.tools.googleFunctionResponse({
    name: functionCall.name,
    args: functionCall.args ?? {},
  });

  const secondTurn = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: "What changed in the latest billing policy?" }] },
      { role: "model", parts: [{ functionCall }] },
      { role: "user", parts: [functionResponsePart] },
    ],
  });

  console.log(secondTurn.text);
}
```

### Vercel AI SDK

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Schift } from "@schift-io/sdk";

const schift = new Schift({ apiKey: process.env.SCHIFT_API_KEY! });

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "What changed in the latest billing policy?",
  tools: schift.tools.vercelAI(),
  maxSteps: 5,
});

console.log(result.text);
```

### Mastra

If you are using Mastra, wrap `client.search()` in a Mastra tool and keep the rest of the agent stack unchanged.

```typescript
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Schift } from "@schift-io/sdk";

const client = new Schift({ apiKey: process.env.SCHIFT_API_KEY! });

const schiftSearchTool = createTool({
  id: "schift-search",
  description: "Retrieve context from a Schift bucket.",
  inputSchema: z.object({
    bucket: z.string(),
    query: z.string(),
    topK: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ context }) => ({
    results: await client.search({
      bucket: context.bucket,
      query: context.query,
      topK: context.topK,
      mode: "hybrid",
    }),
  }),
});

const agent = new Agent({
  name: "docs-agent",
  instructions: "Use schift-search before answering document questions.",
  model: openai("gpt-4o-mini"),
  tools: { schiftSearchTool },
});
```

Examples:

- [`examples/google-genai-rag.ts`](./examples/google-genai-rag.ts)
- [`examples/vercel-ai-rag.ts`](./examples/vercel-ai-rag.ts)

### Buckets

```typescript
// List all buckets
const buckets = await client.listBuckets();

// Legacy collection aliases remain available for older integrations
const col = await client.getCollection("bucket-id");

await client.deleteCollection("bucket-id");
```

### Workflows

Build and run RAG pipelines as composable DAGs.

#### Quick Start

```typescript
// Create from template or blank
const wf = await client.workflows.create({ name: "My RAG Pipeline" });

// Run with inputs (multiple values supported)
const result = await client.workflows.run(wf.id, {
  query: "maternity leave policy",
  language: "ko",
});
console.log(result.outputs);
```

#### CRUD

```typescript
const wf = await client.workflows.create({ name: "Pipeline" });
const all = await client.workflows.list();
const one = await client.workflows.get(wf.id);
const updated = await client.workflows.update(wf.id, { name: "Renamed" });
await client.workflows.delete(wf.id);
```

#### Blocks & Edges

```typescript
// Add blocks
const retriever = await client.workflows.addBlock(wf.id, {
  type: "retriever",
  title: "Search Docs",
  config: { collection: "my-docs", top_k: 5, rerank: true },
});

const llm = await client.workflows.addBlock(wf.id, {
  type: "llm",
  config: {
    model: "openai/gpt-4o-mini", // or "anthropic/claude-sonnet-4-20250514", "gemini-2.5-flash"
    temperature: 0.7,
  },
});

// Connect blocks
await client.workflows.addEdge(wf.id, {
  source: retriever.id,
  target: llm.id,
});

// Remove
await client.workflows.removeBlock(wf.id, retriever.id);
await client.workflows.removeEdge(wf.id, edgeId);
```

#### WorkflowBuilder (Fluent API)

Build a graph locally, then send to the API in one call:

```typescript
import { WorkflowBuilder } from "@schift-io/sdk";

const request = new WorkflowBuilder("My RAG Pipeline")
  .description("Retrieval-augmented generation")
  .addBlock("start", { type: "start" })
  .addBlock("retriever", {
    type: "retriever",
    config: { collection: "my-docs", top_k: 5 },
  })
  .addBlock("prompt", {
    type: "prompt_template",
    config: { template: "Context:\n{{results}}\n\nQ: {{query}}" },
  })
  .addBlock("llm", {
    type: "llm",
    config: { model: "openai/gpt-4o-mini" },
  })
  .addBlock("end", { type: "end" })
  .connect("start", "retriever")
  .connect("retriever", "prompt")
  .connect("prompt", "llm")
  .connect("llm", "end")
  .build();

const wf = await client.workflows.create(request);
```

#### YAML Import / Export

```typescript
// Export
const yaml = await client.workflows.exportYaml(wf.id);

// Import from YAML string
const imported = await client.workflows.importYaml(yamlString);
```

#### Validation & Meta

```typescript
// Validate graph
const { valid, errors } = await client.workflows.validate(wf.id);

// List available block types
const blockTypes = await client.workflows.getBlockTypes();

// List available templates
const templates = await client.workflows.getTemplates();
```

#### Block Types

| Category | Types |
|----------|-------|
| Control | `start`, `end`, `conditional`, `loop` |
| Retrieval | `retriever`, `reranker` |
| LLM | `llm`, `prompt_template`, `answer` |
| Data | `document_loader`, `chunker`, `embedder`, `text_processor` |
| Web | `web_search` |
| Integration | `api_call`, `webhook`, `code_executor` |
| Storage | `vector_store`, `cache` |

## Configuration

```typescript
const client = new Schift({
  apiKey: "sch_...",                      // required
  baseUrl: "https://api.schift.io",       // default
  timeout: 60_000,                        // default, in milliseconds
});
```

## Error Handling

```typescript
import { Schift, AuthError, QuotaError, SchiftError } from "@schift-io/sdk";

try {
  await client.embed({ text: "test" });
} catch (err) {
  if (err instanceof AuthError) {
    // 401: Invalid or expired API key
  } else if (err instanceof QuotaError) {
    // 402: Insufficient credits
  } else if (err instanceof SchiftError) {
    // Other API errors (403, 422, 429, 500, 502)
    console.error(err.message, err.statusCode);
  }
}
```

## Supported Models

| Model | Provider | Dimensions |
|-------|----------|------------|
| `openai/text-embedding-3-small` | OpenAI | 1536 |
| `openai/text-embedding-3-large` | OpenAI | 3072 |
| `gemini/text-embedding-004` | Google | 768 |
| `voyage/voyage-3-large` | Voyage | 1024 |
| `schift-embed-1-preview` | Schift | 1024 |

All models output to a canonical 1024-dimensional space via Schift's projection layer.

## License

MIT
