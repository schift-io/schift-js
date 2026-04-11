/**
 * Editor-specific types: canvas blocks, edges, and block type definitions.
 * Re-exports SDK workflow types that the editor depends on.
 */

export type { Workflow, WorkflowGraph, Block, Edge, Position, BlockConfig } from "../workflow/types.js";
export type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowRun,
  ValidationResult,
} from "../workflow/types.js";

// ---- Block Categories ----

export type BlockCategory =
  | "Control"
  | "Document"
  | "Embedding"
  | "Storage"
  | "Retrieval"
  | "LLM"
  | "Logic"
  | "Transform"
  | "Integration";

// ---- Block Type Definitions ----

export interface BlockTypeDefinition {
  type: string;
  label: string;
  category: BlockCategory;
  icon: string;
  defaultConfig: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
}

// ---- Canvas Types ----

export interface CanvasBlock {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface CanvasEdge {
  id: string;
  sourceBlockId: string;
  sourcePort: string;
  targetBlockId: string;
  targetPort: string;
}

export interface PendingConnection {
  sourceBlockId: string;
  sourcePort: string;
}

// ---- Color Maps ----

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  Control: "bg-slate-600 border-slate-500",
  Document: "bg-blue-900 border-blue-700",
  Embedding: "bg-violet-900 border-violet-700",
  Storage: "bg-emerald-900 border-emerald-700",
  Retrieval: "bg-amber-900 border-amber-700",
  LLM: "bg-rose-900 border-rose-700",
  Logic: "bg-cyan-900 border-cyan-700",
  Transform: "bg-orange-900 border-orange-700",
  Integration: "bg-pink-900 border-pink-700",
};

export const CATEGORY_BADGE_COLORS: Record<BlockCategory, string> = {
  Control: "bg-slate-500/30 text-slate-300",
  Document: "bg-blue-500/20 text-blue-300",
  Embedding: "bg-violet-500/20 text-violet-300",
  Storage: "bg-emerald-500/20 text-emerald-300",
  Retrieval: "bg-amber-500/20 text-amber-300",
  LLM: "bg-rose-500/20 text-rose-300",
  Logic: "bg-cyan-500/20 text-cyan-300",
  Transform: "bg-orange-500/20 text-orange-300",
  Integration: "bg-pink-500/20 text-pink-300",
};

export const CATEGORY_ACCENT: Record<BlockCategory, string> = {
  Control: "border-l-slate-500",
  Document: "border-l-blue-500",
  Embedding: "border-l-violet-500",
  Storage: "border-l-emerald-500",
  Retrieval: "border-l-amber-500",
  LLM: "border-l-rose-500",
  Logic: "border-l-cyan-500",
  Transform: "border-l-orange-500",
  Integration: "border-l-pink-500",
};

// ---- Block Type Registry ----

export const BLOCK_TYPES: BlockTypeDefinition[] = [
  // Control
  { type: "start", label: "Start", category: "Control", icon: "\u25B6", defaultConfig: {}, inputs: [], outputs: ["out"] },
  { type: "end", label: "End", category: "Control", icon: "\u23F9", defaultConfig: {}, inputs: ["in"], outputs: [] },
  // Document
  { type: "document_loader", label: "Document Loader", category: "Document", icon: "\uD83D\uDCC4", defaultConfig: { source: "" }, inputs: ["in"], outputs: ["docs"] },
  { type: "document_parser", label: "Document Parser", category: "Document", icon: "\uD83D\uDCD1", defaultConfig: { mode: "vlm", fields: [], merge_pages: "merge" }, inputs: ["docs", "pages"], outputs: ["documents", "pages", "items"] },
  { type: "chunker", label: "Chunker", category: "Document", icon: "\u2702", defaultConfig: { strategy: "fixed", chunk_size: 512, overlap: 64 }, inputs: ["parsed"], outputs: ["chunks"] },
  // Embedding
  { type: "embedder", label: "Embedder", category: "Embedding", icon: "\u229B", defaultConfig: { model: "text-embedding-3-small", dimensions: 1024 }, inputs: ["chunks"], outputs: ["embeddings"] },
  { type: "model_selector", label: "Model Selector", category: "Embedding", icon: "\u2295", defaultConfig: { provider: "openai" }, inputs: ["in"], outputs: ["out"] },
  // Storage
  { type: "vector_store", label: "Vector Store", category: "Storage", icon: "\u26C1", defaultConfig: { collection: "", upsert: true }, inputs: ["embeddings"], outputs: ["stored"] },
  { type: "collection", label: "Collection", category: "Storage", icon: "\u229E", defaultConfig: { name: "" }, inputs: ["in"], outputs: ["out"] },
  // Retrieval
  { type: "retriever", label: "Retriever", category: "Retrieval", icon: "\u26B2", defaultConfig: { top_k: 7, collection: "" }, inputs: ["query"], outputs: ["results"] },
  { type: "reranker", label: "Reranker", category: "Retrieval", icon: "\u21C5", defaultConfig: { model: "rerank-v1", top_n: 3 }, inputs: ["results", "query"], outputs: ["reranked"] },
  // LLM
  { type: "llm", label: "LLM", category: "LLM", icon: "\u25CE", defaultConfig: { model: "gpt-4o-mini", temperature: 0.7, max_tokens: 1024 }, inputs: ["prompt"], outputs: ["response"] },
  { type: "prompt_template", label: "Prompt Template", category: "LLM", icon: "\u270E", defaultConfig: { template: "" }, inputs: ["vars"], outputs: ["prompt"] },
  { type: "answer", label: "Answer", category: "LLM", icon: "\u25C9", defaultConfig: { format: "text" }, inputs: ["response"], outputs: ["out"] },
  // Logic
  { type: "condition", label: "Condition", category: "Logic", icon: "\u2B21", defaultConfig: { expression: "" }, inputs: ["in"], outputs: ["true", "false"] },
  { type: "router", label: "Router", category: "Logic", icon: "\u2B22", defaultConfig: { routes: [] }, inputs: ["in"], outputs: ["out_0", "out_1", "out_2"] },
  { type: "ai_router", label: "AI Router", category: "Logic", icon: "\uD83E\uDDE0", defaultConfig: { routes: [], model: "gpt-4o-mini", temperature: 0, fallback_route: "" }, inputs: ["in"], outputs: ["out_0", "out_1", "out_2", "route"] },
  { type: "loop", label: "Loop", category: "Logic", icon: "\u21BB", defaultConfig: { max_iterations: 10 }, inputs: ["in"], outputs: ["item", "done"] },
  { type: "merge", label: "Merge", category: "Logic", icon: "\u2B1F", defaultConfig: { strategy: "concat" }, inputs: ["in_0", "in_1"], outputs: ["out"] },
  // Transform
  { type: "code", label: "Code", category: "Transform", icon: "{ }", defaultConfig: { language: "python", code: "" }, inputs: ["in"], outputs: ["out"] },
  { type: "variable", label: "Variable", category: "Transform", icon: "$", defaultConfig: { name: "", value: "" }, inputs: [], outputs: ["value"] },
  { type: "field_selector", label: "Field Selector", category: "Transform", icon: "\u2637", defaultConfig: { fields: [], source: "auto", output_format: "json", flatten: false }, inputs: ["in", "extracted", "tables"], outputs: ["out", "columns", "table"] },
  { type: "metadata_extractor", label: "Metadata Extractor", category: "Transform", icon: "\u22A1", defaultConfig: { fields: [] }, inputs: ["in"], outputs: ["out", "metadata"] },
  // Integration
  { type: "http_request", label: "HTTP Request", category: "Integration", icon: "\u21C6", defaultConfig: { method: "GET", url: "" }, inputs: ["in"], outputs: ["response", "error"] },
  { type: "webhook", label: "Webhook", category: "Integration", icon: "\u21AF", defaultConfig: { url: "", secret: "" }, inputs: ["in"], outputs: ["out"] },
];

export function getBlockTypeDef(type: string): BlockTypeDefinition | undefined {
  return BLOCK_TYPES.find((b) => b.type === type);
}
