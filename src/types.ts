export type Modality = "text" | "image" | "audio" | "video" | "document";

/**
 * Canonical model IDs supported by the Schift embedding catalog.
 * Matches the model_id field returned by GET /v1/catalog.
 */
export type EmbedModelId =
  | "schift-embed-1"
  | "schift-embed-1-preview"
  | "openai/text-embedding-3-small"
  | "openai/text-embedding-3-large"
  | "google/gemini-embedding-001"
  | "google/gemini-embedding-002"
  | "dragonkue/bge-m3-ko"
  | "jinaai/jina-embeddings-v3"
  | "sbintuitions/sarashina-embedding-v2-1b"
  | "voyage/voyage-4-large"
  | "voyage/voyage-4"
  | "voyage/voyage-4-lite"
  | (string & {}); // allow unknown future models without a compile error

/** A single entry from the Schift model catalog (GET /v1/catalog). */
export interface CatalogModel {
  model_id: string;
  provider: string;
  display_name: string;
  dimensions: number;
  max_tokens: number;
  supports_dimensions: boolean;
  pricing_per_1k_tokens: number;
  modalities?: Modality[];
  internal?: boolean;
  [key: string]: unknown;
}

export type TaskType =
  | "retrieval_document"
  | "retrieval_query"
  | "semantic_similarity"
  | "classification"
  | "clustering"
  | "question_answering"
  | "fact_verification"
  | "code_retrieval";

export interface SchiftConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface EmbedRequest {
  /** Single text to embed. Use `texts` for batch requests. */
  text: string;
  model?: string;
  dimensions?: number;
  taskType?: TaskType;
}

export interface EmbedBatchRequest {
  /** Array of texts to embed in one request. */
  texts: string[];
  model?: string;
  dimensions?: number;
  taskType?: TaskType;
}

export interface EmbedResponse {
  embedding: number[];
  model: string;
  dimensions: number;
  usage: {
    tokens: number;
  };
}

export interface EmbedBatchResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage: {
    tokens: number;
    count: number;
  };
}

export type TemporalType = "before" | "after" | "between" | "as_of" | "latest";

export interface SearchRequest {
  query: string;
  collection: string;
  topK?: number;
  modalities?: Modality[];
  /** Temporal constraint type for time-range filtering on event_time. */
  temporal?: TemporalType;
  /** Epoch millis — used by all temporal types except "latest". */
  temporalStart?: number;
  /** Epoch millis — used by "between" only. */
  temporalEnd?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  modality?: Modality;
  metadata?: Record<string, string>;
  location?: {
    page?: number;
    timestamp?: number;
    frame?: number;
  };
}

export interface ProjectRequest {
  vectors: number[][];
  source: string;
  targetDimensions?: number;
}

export interface ProjectResponse {
  vectors: number[][];
  source: string;
  target: string;
  dimensions: number;
}

export interface FileUploadResponse {
  fileId: string;
  filename: string;
  bytes: number;
  mimeType: string;
  status: "processing" | "ready" | "error";
}

// ---- Bucket / DB ----

export interface BucketUploadResult {
  // K-L5: Accept both snake_case (backend) and camelCase (SDK convention)
  bucket_id: string;
  bucket_name: string;
  bucketId?: string;
  bucketName?: string;
  /** Per-file results returned by the server. */
  uploaded: unknown[];
}

// ---- Aggregation ----

export interface AggregateRequest {
  collection: string;
  groupBy: string;
  filterKey?: string;
  filterValue?: string;
}

export interface AggregateGroup {
  value: string;
  count: number;
}

export interface AggregateResponse {
  groups: AggregateGroup[];
  total: number;
}

// ---- RAG Chat ----

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  bucketId: string;
  message: string;
  history?: ChatMessage[];
  model?: string;
  topK?: number;
  stream?: boolean;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatSource {
  id: string;
  score: number;
  text: string;
}

export interface ChatResponse {
  reply: string;
  sources: ChatSource[];
  model: string;
}

export interface ChatStreamEvent {
  type: "sources" | "chunk" | "done" | "error";
  sources?: ChatSource[];
  content?: string;
  message?: string;
}
