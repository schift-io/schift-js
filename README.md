# @schift/sdk

Schift TypeScript SDK — Multimodal Embedding API & Model Routing.

## Install

```bash
npm install @schift/sdk
```

## Quick Start

```typescript
import { Schift } from "@schift/sdk";

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

Build and run RAG pipelines:

```typescript
// Create a workflow
const wf = await client.workflows.create({ name: "My RAG Pipeline" });

// List workflows
const workflows = await client.workflows.list();

// Run a workflow
const result = await client.workflows.run(wf.id, { query: "hello" });
```

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
import { Schift, AuthError, QuotaError, SchiftError } from "@schift/sdk";

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
