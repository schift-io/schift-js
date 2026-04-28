export { WorkflowClient } from "./client.js";
export type { HttpTransport } from "./client.js";
export { WorkflowBuilder } from "./builder.js";
export type { BlockDescriptor } from "./builder.js";
export {
  BlockType,
  WorkflowStatus,
  RunStatus,
  BlockRunStatus,
  WorkflowTemplate,
} from "./types.js";
export type {
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
  RunLogEntry,
  RunLogsResponse,
  AsyncRunResponse,
} from "./types.js";

// ---- YAML Serialization ----
export {
  workflowFromYaml,
  workflowToYaml,
  validateDefinition,
  definitionFromApiResponse,
  definitionToApiDict,
  titleFromType,
} from "./yaml.js";
export type {
  WorkflowDefinition,
  BlockDef,
  EdgeDef,
} from "./yaml.js";

// ---- Local Execution Engine ----
export {
  WorkflowRunner,
  ExecutionContext,
} from "./engine.js";
export type {
  BlockRunResult,
  WorkflowRunResult,
} from "./engine.js";

// ---- Node Handlers ----
export {
  SDKBaseNodeClass as SDKBaseNode,
  registerCustomNode,
  unregisterCustomNode,
  getNodeHandler,
} from "./nodes.js";

// ---- Connection Types (typed ports for node I/O) ----
export {
  ConnectionTypes,
  ConnectionFamilies,
  allConnectionTypes,
  familyOf,
  isCompatible,
} from "./connection-types.js";
export type {
  ConnectionType,
  AIConnectionType,
  ConnectionFamily,
} from "./connection-types.js";

// ---- Node Descriptor (UI form schema + codex metadata, n8n-derived) ----
export { mainPort, sidecarPort } from "./descriptor.js";
export type {
  INodeDescriptor,
  INodeProperty,
  PropertyType,
  PropertyTypeOptions,
  DisplayOptions,
  NodeCodex,
  BuilderHint,
  PortDescriptor,
  NodeGroup,
} from "./descriptor.js";

// ---- Descriptor Registry (lookup / search / category grouping) ----
export {
  Category,
  getDescriptor,
  listDescriptors,
  descriptorsByCategory,
  searchDescriptors,
  descriptorsByCategoryGrouped,
} from "./descriptors.js";
export type { CategoryName } from "./descriptors.js";

// ---- n8n Workflow Importer ----
export { importN8nWorkflow } from "./n8n-import.js";
export type {
  N8nWorkflow,
  N8nNode,
  N8nConnections,
  N8nConnectionTarget,
  N8nImportResult,
} from "./n8n-import.js";
