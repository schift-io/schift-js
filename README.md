# @schift-io/sdk

Schift TypeScript SDK — Multimodal Embedding API & Model Routing.

## Install

```bash
npm install @schift-io/sdk
```

## Quick Start

```typescript
import { Schift } from "@schift-io/sdk";

const client = new Schift({ apiKey: "sch_your_api_key" });

// Embed a single text
const { embedding, dimensions } = await client.embed({
  text: "Hello, world!",
  model: "openai/text-embedding-3-small",
});
console.log(`Dimension: ${dimensions}, vector: [${embedding.slice(0, 3).join(", ")}, ...]`);

// Batch embed
const { embeddings } = await client.embedBatch({
  texts: ["first document", "second document"],
  model: "openai/text-embedding-3-small",
  dimensions: 1024,
});
```

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
  collection: "my-docs",
  topK: 10,
});
// results: Array<{ id, score, modality, metadata? }>
```

### Collections

```typescript
// List all collections
const collections = await client.listCollections();

// Get collection details
const col = await client.getCollection("collection-id");

// Delete collection
await client.deleteCollection("collection-id");
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
