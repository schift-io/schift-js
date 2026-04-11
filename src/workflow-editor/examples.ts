/**
 * Example workflow compositions using the SDK builder.
 *
 * These demonstrate common patterns users can build with Schift blocks.
 * Each example can be passed directly to `schift.workflows.create()`.
 */

import { WorkflowBuilder } from "../workflow/builder.js";

// ---- 1. Basic RAG Ingestion ----
// Document → Chunk → Embed → Store
export const basicRagIngest = new WorkflowBuilder("Basic RAG Ingestion")
  .description("Ingest documents into a vector store for RAG retrieval")
  .addBlock("start", { type: "start" })
  .addBlock("loader", {
    type: "document_loader",
    title: "Load PDFs",
    config: { source: "upload" },
  })
  .addBlock("parser", {
    type: "document_parser",
    title: "Parse Documents",
    config: { format: "auto" },
  })
  .addBlock("chunker", {
    type: "chunker",
    title: "Chunk Text",
    config: { strategy: "semantic", chunk_size: 512, overlap: 64 },
  })
  .addBlock("embedder", {
    type: "embedder",
    title: "Generate Embeddings",
    config: { model: "text-embedding-3-small", dimensions: 1024 },
  })
  .addBlock("store", {
    type: "vector_store",
    title: "Upsert to Collection",
    config: { collection: "documents", upsert: true },
  })
  .addBlock("end", { type: "end" })
  .connect("start", "loader", "out", "in")
  .connect("loader", "parser", "docs", "docs")
  .connect("parser", "chunker", "parsed", "parsed")
  .connect("chunker", "embedder", "chunks", "chunks")
  .connect("embedder", "store", "embeddings", "embeddings")
  .connect("store", "end", "stored", "in")
  .build();

// ---- 2. RAG Query Pipeline ----
// Query → Retrieve → Rerank → Prompt → LLM → Answer
export const ragQuery = new WorkflowBuilder("RAG Query")
  .description("Retrieve context and generate an answer for a user query")
  .addBlock("start", { type: "start" })
  .addBlock("retriever", {
    type: "retriever",
    title: "Retrieve from Docs",
    config: { top_k: 10, collection: "documents" },
  })
  .addBlock("reranker", {
    type: "reranker",
    title: "Rerank Results",
    config: { model: "rerank-v1", top_n: 3 },
  })
  .addBlock("prompt", {
    type: "prompt_template",
    title: "Build RAG Prompt",
    config: {
      template:
        "Answer the question based on the context below.\n\nContext:\n{{context}}\n\nQuestion: {{query}}\n\nAnswer:",
    },
  })
  .addBlock("llm", {
    type: "llm",
    title: "Generate Answer",
    config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1024 },
  })
  .addBlock("answer", { type: "answer", config: { format: "text" } })
  .addBlock("end", { type: "end" })
  .connect("start", "retriever", "out", "query")
  .connect("retriever", "reranker", "results", "results")
  .connect("start", "reranker", "out", "query")
  .connect("reranker", "prompt", "reranked", "vars")
  .connect("prompt", "llm", "prompt", "prompt")
  .connect("llm", "answer", "response", "response")
  .connect("answer", "end", "out", "in")
  .build();

// ---- 3. Contract Analysis with Structured Output ----
// Load contract → Parse → LLM with JSON schema → Answer
export const contractAnalysis = new WorkflowBuilder("Contract Analysis")
  .description("Extract structured data from legal contracts")
  .addBlock("start", { type: "start" })
  .addBlock("loader", {
    type: "document_loader",
    title: "Load Contract",
    config: { source: "upload" },
  })
  .addBlock("parser", {
    type: "document_parser",
    title: "OCR + Parse",
    config: { format: "auto" },
  })
  .addBlock("prompt", {
    type: "prompt_template",
    title: "Extraction Prompt",
    config: {
      template:
        "Extract the following from this contract:\n- Parties involved\n- Effective date\n- All clauses with numbers and text\n- Key obligations\n\nContract:\n{{document}}\n\nReturn as structured JSON.",
    },
  })
  .addBlock("llm", {
    type: "llm",
    title: "Extract via LLM",
    config: {
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 4096,
      output_schema: {
        type: "object",
        properties: {
          parties: { type: "array", items: { type: "string" } },
          effective_date: { type: "string" },
          clauses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "string" },
                title: { type: "string" },
                text: { type: "string" },
                obligations: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  })
  .addBlock("meta", {
    type: "metadata_extractor",
    title: "Extract Metadata",
    config: { fields: ["parties", "effective_date"] },
  })
  .addBlock("answer", { type: "answer", config: { format: "json" } })
  .addBlock("end", { type: "end" })
  .connect("start", "loader", "out", "in")
  .connect("loader", "parser", "docs", "docs")
  .connect("parser", "prompt", "parsed", "vars")
  .connect("prompt", "llm", "prompt", "prompt")
  .connect("llm", "meta", "response", "in")
  .connect("llm", "answer", "response", "response")
  .connect("answer", "end", "out", "in")
  .build();

// ---- 4. Conditional Routing ----
// Query → LLM classify → Route to different handlers
export const conditionalRouting = new WorkflowBuilder("Intent Router")
  .description("Classify user intent and route to specialized handlers")
  .addBlock("start", { type: "start" })
  .addBlock("classify_prompt", {
    type: "prompt_template",
    title: "Classify Intent",
    config: {
      template:
        'Classify this query into one of: "search", "create", "delete".\nQuery: {{query}}\nIntent:',
    },
  })
  .addBlock("classifier", {
    type: "llm",
    title: "Intent LLM",
    config: { model: "gpt-4o-mini", temperature: 0, max_tokens: 10 },
  })
  .addBlock("router", {
    type: "router",
    title: "Route by Intent",
    config: { routes: ["search", "create", "delete"] },
  })
  .addBlock("search_handler", {
    type: "retriever",
    title: "Search Handler",
    config: { top_k: 7, collection: "knowledge" },
  })
  .addBlock("create_handler", {
    type: "http_request",
    title: "Create API Call",
    config: { method: "POST", url: "/api/items" },
  })
  .addBlock("delete_handler", {
    type: "http_request",
    title: "Delete API Call",
    config: { method: "DELETE", url: "/api/items" },
  })
  .addBlock("merge", {
    type: "merge",
    title: "Merge Results",
    config: { strategy: "concat" },
  })
  .addBlock("answer", { type: "answer", config: { format: "text" } })
  .addBlock("end", { type: "end" })
  .connect("start", "classify_prompt", "out", "vars")
  .connect("classify_prompt", "classifier", "prompt", "prompt")
  .connect("classifier", "router", "response", "in")
  .connect("router", "search_handler", "out_0", "query")
  .connect("router", "create_handler", "out_1", "in")
  .connect("router", "delete_handler", "out_2", "in")
  .connect("search_handler", "merge", "results", "in_0")
  .connect("create_handler", "merge", "response", "in_1")
  .connect("merge", "answer", "out", "response")
  .connect("answer", "end", "out", "in")
  .build();

// ---- 5. Invoice Table Extraction ----
// OCR → Parse tables → Select specific columns → LLM summary
export const invoiceTableExtraction = new WorkflowBuilder("Invoice Table Extraction")
  .description("OCR invoices, extract line items table, pick columns, and summarize")
  .addBlock("start", { type: "start" })
  .addBlock("loader", {
    type: "document_loader",
    title: "Load Invoice PDF",
    config: { source_type: "pdf", ocr_strategy: "auto" },
  })
  .addBlock("parser", {
    type: "document_parser",
    title: "Extract Tables (VLM)",
    config: {
      mode: "vlm",
      output_schema: {
        type: "object",
        properties: {
          invoice_number: { type: "string" },
          date: { type: "string" },
          vendor: { type: "string" },
          total_amount: { type: "number" },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                amount: { type: "number" },
              },
            },
          },
        },
      },
    },
  })
  .addBlock("selector", {
    type: "field_selector",
    title: "Pick Columns",
    config: {
      fields: [
        "invoice_number",
        "vendor",
        "total_amount",
        "line_items[].description",
        "line_items[].amount",
      ],
      rename: {
        "line_items[].description": "item_names",
        "line_items[].amount": "item_amounts",
      },
      source: "extracted",
      output_format: "json",
    },
  })
  .addBlock("prompt", {
    type: "prompt_template",
    title: "Summarize Invoice",
    config: {
      template:
        "Summarize this invoice:\nVendor: {{vendor}}\nInvoice #: {{invoice_number}}\nTotal: {{total_amount}}\n\nLine items:\n{{item_names}}\n\nProvide a 2-sentence summary.",
    },
  })
  .addBlock("llm", {
    type: "llm",
    config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 256 },
  })
  .addBlock("answer", { type: "answer", config: { format: "text" } })
  .addBlock("end", { type: "end" })
  .connect("start", "loader", "out", "in")
  .connect("loader", "parser", "docs", "docs")
  .connect("parser", "selector", "documents", "in")
  .connect("selector", "prompt", "out", "vars")
  .connect("prompt", "llm", "prompt", "prompt")
  .connect("llm", "answer", "response", "response")
  .connect("answer", "end", "out", "in")
  .build();

// ---- 6. Contract Clause Table to CSV ----
// OCR contract → Parse → Select clause columns → Export as CSV
export const contractClauseExtractor = new WorkflowBuilder("Contract Clause Extractor")
  .description("Extract contract clauses as a structured table with selected columns")
  .addBlock("start", { type: "start" })
  .addBlock("loader", {
    type: "document_loader",
    title: "Load Contract",
    config: { source_type: "pdf", ocr_strategy: "auto" },
  })
  .addBlock("parser", {
    type: "document_parser",
    title: "Parse Contract (VLM)",
    config: {
      mode: "vlm",
      output_schema: {
        type: "object",
        properties: {
          parties: { type: "array", items: { type: "string" } },
          effective_date: { type: "string" },
          clauses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "string" },
                title: { type: "string" },
                text: { type: "string" },
                obligations: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  })
  .addBlock("selector", {
    type: "field_selector",
    title: "Pick Clause Columns",
    config: {
      fields: [
        "clauses[].number",
        "clauses[].title",
        "clauses[].obligations[]",
      ],
      rename: {
        "clauses[].number": "clause_no",
        "clauses[].title": "clause_title",
        "clauses[].obligations[]": "obligations",
      },
      output_format: "table",
    },
  })
  .addBlock("webhook", {
    type: "webhook",
    title: "Send to Slack/API",
    config: { url: "" },
  })
  .addBlock("end", { type: "end" })
  .connect("start", "loader", "out", "in")
  .connect("loader", "parser", "docs", "docs")
  .connect("parser", "selector", "documents", "in")
  .connect("selector", "webhook", "out", "in")
  .connect("selector", "end", "out", "in")
  .build();

// ---- 7. Multi-Source RAG with Webhook Notification ----
export const multiSourceRag = new WorkflowBuilder("Multi-Source RAG + Notify")
  .description("Query multiple collections, merge results, and send webhook")
  .addBlock("start", { type: "start" })
  .addBlock("retriever_docs", {
    type: "retriever",
    title: "Search Docs",
    config: { top_k: 7, collection: "documents" },
  })
  .addBlock("retriever_faq", {
    type: "retriever",
    title: "Search FAQ",
    config: { top_k: 3, collection: "faq" },
  })
  .addBlock("merge", {
    type: "merge",
    title: "Merge Sources",
    config: { strategy: "concat" },
  })
  .addBlock("reranker", {
    type: "reranker",
    title: "Rerank All",
    config: { model: "rerank-v1", top_n: 5 },
  })
  .addBlock("prompt", {
    type: "prompt_template",
    config: {
      template:
        "Using the following sources, answer the question.\n\nSources:\n{{context}}\n\nQuestion: {{query}}",
    },
  })
  .addBlock("llm", {
    type: "llm",
    config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 2048 },
  })
  .addBlock("answer", { type: "answer", config: { format: "text" } })
  .addBlock("webhook", {
    type: "webhook",
    title: "Notify Slack",
    config: { url: "https://hooks.slack.com/services/xxx", secret: "" },
  })
  .addBlock("end", { type: "end" })
  .connect("start", "retriever_docs", "out", "query")
  .connect("start", "retriever_faq", "out", "query")
  .connect("retriever_docs", "merge", "results", "in_0")
  .connect("retriever_faq", "merge", "results", "in_1")
  .connect("merge", "reranker", "out", "results")
  .connect("start", "reranker", "out", "query")
  .connect("reranker", "prompt", "reranked", "vars")
  .connect("prompt", "llm", "prompt", "prompt")
  .connect("llm", "answer", "response", "response")
  .connect("answer", "webhook", "out", "in")
  .connect("answer", "end", "out", "in")
  .build();
