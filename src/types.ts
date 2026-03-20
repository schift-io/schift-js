export type Modality = "text" | "image" | "audio" | "video" | "document";

export type TaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"
  | "QUESTION_ANSWERING"
  | "FACT_VERIFICATION"
  | "CODE_RETRIEVAL";

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
}

export interface EmbedBatchRequest {
  /** Array of texts to embed in one request. */
  texts: string[];
  model?: string;
  dimensions?: number;
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

export interface SearchRequest {
  query: string;
  collection: string;
  topK?: number;
  modalities?: Modality[];
}

export interface SearchResult {
  id: string;
  score: number;
  modality: Modality;
  metadata?: Record<string, unknown>;
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
  bucket_id: string;
  bucket_name: string;
  /** Per-file results returned by the server. */
  uploaded: unknown[];
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
