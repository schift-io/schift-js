// ---- Main Components ----
export { default as WorkflowEditor } from "./components/WorkflowEditor.js";
export type { WorkflowEditorProps } from "./components/WorkflowEditor.js";
export { default as WorkflowBuilder } from "./components/WorkflowBuilder.js";
export type { StickyNote, BlockStatus } from "./components/WorkflowBuilder.js";
export { default as WorkflowCanvas } from "./components/WorkflowCanvas.js";
export { default as WorkflowList } from "./components/WorkflowList.js";
export { default as BlockPalette } from "./components/BlockPalette.js";
export { default as BlockConfigPanel } from "./components/BlockConfigPanel.js";
export { default as SchemaBuilder } from "./components/SchemaBuilder.js";

// ---- Provider & Hooks ----
export {
  WorkflowEditorProvider,
  useWorkflowAPI,
  useWorkflowUI,
  useBlockTypes,
} from "./context.js";
export type { WorkflowEditorProviderProps } from "./context.js";

// ---- Adapter Interfaces ----
export type {
  WorkflowEditorAPI,
  GenerateWorkflowResult,
  UIComponents,
  ButtonProps,
  InputProps,
  DialogProps,
  DialogContentProps,
  SimpleChildProps,
  AlertProps,
  LoadingSpinnerProps,
} from "./adapter.js";

// ---- Default UI ----
export { DEFAULT_UI } from "./defaults.js";

// ---- Editor Types ----
export type {
  BlockCategory,
  BlockTypeDefinition,
  CanvasBlock,
  CanvasEdge,
  PendingConnection,
} from "./types.js";
export {
  BLOCK_TYPES,
  CATEGORY_COLORS,
  CATEGORY_BADGE_COLORS,
  CATEGORY_ACCENT,
  getBlockTypeDef,
} from "./types.js";

// ---- Utilities ----
export {
  workflowToEditorState,
  editorStateToGraph,
} from "./utils/workflow-graph.js";
export type { WorkflowEditorState } from "./utils/workflow-graph.js";

// ---- Example Workflows ----
export {
  basicRagIngest,
  ragQuery,
  contractAnalysis,
  conditionalRouting,
  invoiceTableExtraction,
  contractClauseExtractor,
  multiSourceRag,
} from "./examples.js";
