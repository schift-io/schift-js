export { Schift } from "./client.js";
export { SchiftError, AuthError, QuotaError } from "./errors.js";
export type {
  EmbedRequest,
  EmbedResponse,
  EmbedBatchRequest,
  EmbedBatchResponse,
  SearchRequest,
  SearchResult,
  ProjectRequest,
  ProjectResponse,
  SchiftConfig,
  Modality,
  TaskType,
  EmbedModelId,
  CatalogModel,
  AggregateRequest,
  AggregateGroup,
  AggregateResponse,
  TemporalType,
} from "./types.js";

// ---- Tool Calling ----
export { SchiftTools } from "./tools.js";

// ---- Workflow ----
export { WorkflowClient, WorkflowBuilder } from "./workflow/index.js";
export {
  BlockType,
  WorkflowStatus,
  RunStatus,
  BlockRunStatus,
  WorkflowTemplate,
} from "./workflow/index.js";
export type {
  HttpTransport,
  BlockDescriptor,
  Position,
  BlockConfig,
  Block,
  Edge,
  WorkflowGraph,
  Workflow,
  BlockRunState,
  WorkflowRun,
  BlockTypeInfo,
  TemplateInfo,
  ValidationError,
  ValidationResult,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  AddBlockRequest,
  AddEdgeRequest,
  RunWorkflowRequest,
  ListWorkflowsResponse,
  ListBlockTypesResponse,
  ListTemplatesResponse,
} from "./workflow/index.js";

// ---- Workflow YAML ----
export {
  workflowFromYaml,
  workflowToYaml,
  validateDefinition,
  definitionFromApiResponse,
  definitionToApiDict,
  titleFromType,
} from "./workflow/index.js";
export type {
  WorkflowDefinition,
  BlockDef,
  EdgeDef,
} from "./workflow/index.js";

// ---- Workflow Engine ----
export {
  WorkflowRunner,
  ExecutionContext,
} from "./workflow/index.js";
export type {
  BlockRunResult,
  WorkflowRunResult,
} from "./workflow/index.js";

// ---- Workflow Nodes ----
export {
  SDKBaseNode,
  registerCustomNode,
  unregisterCustomNode,
  getNodeHandler,
} from "./workflow/index.js";
