// ---- Block Types ----

export const BlockType = {
  START: "start",
  END: "end",
  DOCUMENT_LOADER: "document_loader",
  DOCUMENT_PARSER: "document_parser",
  CHUNKER: "chunker",
  EMBEDDER: "embedder",
  MODEL_SELECTOR: "model_selector",
  VECTOR_STORE: "vector_store",
  COLLECTION: "collection",
  RETRIEVER: "retriever",
  RERANKER: "reranker",
  LLM: "llm",
  PROMPT_TEMPLATE: "prompt_template",
  CONDITION: "condition",
  ROUTER: "router",
  AI_ROUTER: "ai_router",
  LOOP: "loop",
  CODE: "code",
  MERGE: "merge",
  VARIABLE: "variable",
  FIELD_SELECTOR: "field_selector",
  HTTP_REQUEST: "http_request",
  WEBHOOK: "webhook",
  ANSWER: "answer",
  METADATA_EXTRACTOR: "metadata_extractor",
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

// ---- Workflow & Run Status ----

export const WorkflowStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const RunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

// ---- Templates ----

export const WorkflowTemplate = {
  BASIC_RAG: "basic_rag",
  DOCUMENT_QA: "document_qa",
  CONVERSATIONAL_RAG: "conversational_rag",
  MULTI_SOURCE_RAG: "multi_source_rag",
  AGENTIC_RAG: "agentic_rag",
} as const;

export type WorkflowTemplate =
  (typeof WorkflowTemplate)[keyof typeof WorkflowTemplate];

// ---- Position ----

export interface Position {
  x: number;
  y: number;
}

// ---- Block Config ----

export type BlockConfig = Record<string, unknown>;

// ---- Block ----

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  position: Position;
  config: BlockConfig;
}

// ---- Edge ----

export interface Edge {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
}

// ---- Workflow Graph ----

export interface WorkflowGraph {
  blocks: Block[];
  edges: Edge[];
}

// ---- Workflow ----

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
}

// ---- Block Run State ----

export const BlockRunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type BlockRunStatus =
  (typeof BlockRunStatus)[keyof typeof BlockRunStatus];

export interface BlockRunState {
  block_id: string;
  status: BlockRunStatus;
  output?: unknown;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

// ---- Workflow Run ----

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: RunStatus;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  block_states: BlockRunState[];
  error?: string;
  started_at: string;
  finished_at?: string;
}

// ---- Block Type Info (from /meta/block-types) ----

export interface BlockTypeInfo {
  type: BlockType;
  label: string;
  description: string;
  category: string;
  default_config: BlockConfig;
  input_handles: string[];
  output_handles: string[];
}

// ---- Template Info (from /meta/templates) ----

export interface TemplateInfo {
  id: WorkflowTemplate;
  name: string;
  description: string;
  graph: WorkflowGraph;
}

// ---- Validation ----

export interface ValidationError {
  block_id?: string;
  edge_id?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ---- Request Types ----

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  template?: WorkflowTemplate;
  graph?: WorkflowGraph;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  graph?: WorkflowGraph;
}

export interface AddBlockRequest {
  type: BlockType;
  title?: string;
  position?: Position;
  config?: BlockConfig;
}

export interface AddEdgeRequest {
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
}

export interface RunWorkflowRequest {
  inputs?: Record<string, unknown>;
}

// ---- Response Types ----

export interface ListWorkflowsResponse {
  workflows: Workflow[];
}

export interface ListBlockTypesResponse {
  block_types: BlockTypeInfo[];
}

export interface ListTemplatesResponse {
  templates: TemplateInfo[];
}
