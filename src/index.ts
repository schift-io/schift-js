export { Schift } from "./client.js";
export { openaiClient } from "./openai-compat.js";
export type { OpenAIClientOptions } from "./openai-compat.js";
export { SchiftError, AuthError, QuotaError, EntitlementError } from "./errors.js";
export type {
  EmbedRequest,
  EmbedResponse,
  EmbedBatchRequest,
  EmbedBatchResponse,
  EmbedImageRequest,
  EmbedImageResponse,
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

// ---- Providers (BYOK) ----
export { ProvidersClient } from "./providers/index.js";
export type {
  ProviderName,
  ProviderConfig,
  SetProviderKeyRequest,
} from "./providers/index.js";

// ---- Migrate (vectors-in → schift hub) ----
export { MigrateClient } from "./migrate/index.js";
export type {
  ConnectorKind,
  SourceConfig,
  FeasibilityRequest,
  FeasibilityResponse,
  QuoteRequest,
  QuoteResponse,
  StartRequest,
  StartResponse,
  JobStatus,
} from "./migrate/index.js";

// ---- Managed Agents ----
export { AgentsClient, RunsClient } from "./agents/index.js";
export type {
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentResponse,
  CreateRunRequest,
  RunResponse,
  RunEvent,
  RagConfig,
  AgentToolDef,
} from "./agents/index.js";

// ---- Agent Framework ----
export {
  Agent,
  RAG,
  WebSearch,
  DeepResearch,
  ToolRegistry,
  AgentRuntime,
  ConversationMemory,
  AgentError,
  ToolError,
  MaxStepsError,
  WebSearchProvider,
  OpenAIModel,
  GeminiModel,
  ClaudeModel,
  AgentEventEmitter,
  SkillLoader,
  SkillResolver,
  loadSkills,
  PolicyEngine,
  policyViolation,
  ExtensionHost,
} from "./agent/index.js";
export type {
  AgentOptions,
  LLMCallFn,
  AgentConfig,
  AgentTool,
  AgentStep,
  AgentRunResult,
  ToolResult,
  JSONSchema,
  ChatMessage,
  MemoryConfig,
  RAGConfig,
  WebSearchConfig,
  WebSearchResultItem,
  DeepResearchConfig,
  ResearchReport,
  ModelId,
  RunOptions,
  SkillsConfig,
  SkillContract,
  MCPServerConfig,
  AgentEvent,
  AgentEventType,
  AgentEventMap,
  Skill,
  SkillFrontmatter,
  SkillSummary,
  ResolvedSkill,
  PolicyDecision,
  ExtensionAPI,
  ExtensionInitFn,
} from "./agent/index.js";
