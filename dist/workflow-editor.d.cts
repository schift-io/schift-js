import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';

interface WorkflowEditorProps {
    /** Called when user navigates to another section */
    onNavigate?: (sectionId: string) => void;
}
/**
 * Top-level workflow editor component.
 * Switches between list view and builder view.
 *
 * Must be wrapped in a `<WorkflowEditorProvider>`.
 */
declare function WorkflowEditor({ onNavigate: _onNavigate }: WorkflowEditorProps): react_jsx_runtime.JSX.Element;

interface StickyNote {
    id: string;
    text: string;
    position: {
        x: number;
        y: number;
    };
    color: string;
}
type BlockStatus = "idle" | "pending" | "running" | "completed" | "failed";
interface WorkflowBuilderProps {
    onBack: () => void;
    initialWorkflowId?: string | null;
}
declare function WorkflowBuilder({ onBack, initialWorkflowId }: WorkflowBuilderProps): react_jsx_runtime.JSX.Element;

declare const BlockType: {
    readonly START: "start";
    readonly END: "end";
    readonly DOCUMENT_LOADER: "document_loader";
    readonly DOCUMENT_PARSER: "document_parser";
    readonly CHUNKER: "chunker";
    readonly EMBEDDER: "embedder";
    readonly MODEL_SELECTOR: "model_selector";
    readonly VECTOR_STORE: "vector_store";
    readonly COLLECTION: "collection";
    readonly RETRIEVER: "retriever";
    readonly RERANKER: "reranker";
    readonly LLM: "llm";
    readonly PROMPT_TEMPLATE: "prompt_template";
    readonly CONDITION: "condition";
    readonly ROUTER: "router";
    readonly AI_ROUTER: "ai_router";
    readonly LOOP: "loop";
    readonly CODE: "code";
    readonly MERGE: "merge";
    readonly VARIABLE: "variable";
    readonly FIELD_SELECTOR: "field_selector";
    readonly HTTP_REQUEST: "http_request";
    readonly WEBHOOK: "webhook";
    readonly ANSWER: "answer";
    readonly METADATA_EXTRACTOR: "metadata_extractor";
};
type BlockType = (typeof BlockType)[keyof typeof BlockType];
declare const WorkflowStatus: {
    readonly DRAFT: "draft";
    readonly ACTIVE: "active";
    readonly ARCHIVED: "archived";
};
type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];
declare const RunStatus: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];
declare const WorkflowTemplate: {
    readonly BASIC_RAG: "basic_rag";
    readonly DOCUMENT_QA: "document_qa";
    readonly CONVERSATIONAL_RAG: "conversational_rag";
    readonly MULTI_SOURCE_RAG: "multi_source_rag";
    readonly AGENTIC_RAG: "agentic_rag";
};
type WorkflowTemplate = (typeof WorkflowTemplate)[keyof typeof WorkflowTemplate];
interface Position {
    x: number;
    y: number;
}
type BlockConfig = Record<string, unknown>;
interface Block {
    id: string;
    type: BlockType;
    title: string;
    position: Position;
    config: BlockConfig;
}
interface Edge {
    id: string;
    source: string;
    target: string;
    source_handle?: string;
    target_handle?: string;
}
interface WorkflowGraph {
    blocks: Block[];
    edges: Edge[];
}
interface Workflow {
    id: string;
    name: string;
    description: string;
    status: WorkflowStatus;
    graph: WorkflowGraph;
    created_at: string;
    updated_at: string;
}
declare const BlockRunStatus: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly SKIPPED: "skipped";
};
type BlockRunStatus = (typeof BlockRunStatus)[keyof typeof BlockRunStatus];
interface BlockRunState {
    block_id: string;
    status: BlockRunStatus;
    output?: unknown;
    error?: string;
    started_at?: string;
    finished_at?: string;
}
interface WorkflowRun {
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
interface ValidationError {
    block_id?: string;
    edge_id?: string;
    message: string;
}
interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
interface CreateWorkflowRequest {
    name: string;
    description?: string;
    template?: WorkflowTemplate;
    graph?: WorkflowGraph;
}
interface UpdateWorkflowRequest {
    name?: string;
    description?: string;
    status?: WorkflowStatus;
    graph?: WorkflowGraph;
}

/**
 * Editor-specific types: canvas blocks, edges, and block type definitions.
 * Re-exports SDK workflow types that the editor depends on.
 */

type BlockCategory = "Control" | "Document" | "Embedding" | "Storage" | "Retrieval" | "LLM" | "Logic" | "Transform" | "Integration";
interface BlockTypeDefinition {
    type: string;
    label: string;
    category: BlockCategory;
    icon: string;
    defaultConfig: Record<string, unknown>;
    inputs: string[];
    outputs: string[];
}
interface CanvasBlock {
    id: string;
    type: string;
    title: string;
    config: Record<string, unknown>;
    position: {
        x: number;
        y: number;
    };
}
interface CanvasEdge {
    id: string;
    sourceBlockId: string;
    sourcePort: string;
    targetBlockId: string;
    targetPort: string;
}
interface PendingConnection {
    sourceBlockId: string;
    sourcePort: string;
}
declare const CATEGORY_COLORS: Record<BlockCategory, string>;
declare const CATEGORY_BADGE_COLORS: Record<BlockCategory, string>;
declare const CATEGORY_ACCENT: Record<BlockCategory, string>;
declare const BLOCK_TYPES: BlockTypeDefinition[];
declare function getBlockTypeDef(type: string): BlockTypeDefinition | undefined;

interface WorkflowCanvasProps {
    blocks: CanvasBlock[];
    edges: CanvasEdge[];
    selectedBlockId: string | null;
    selectedBlockIds: Set<string>;
    blockStatuses: Map<string, BlockStatus>;
    stickyNotes: StickyNote[];
    onSelectBlock: (id: string | null, additive?: boolean) => void;
    onMoveBlock: (id: string, pos: {
        x: number;
        y: number;
    }) => void;
    onDropBlock: (type: string, pos: {
        x: number;
        y: number;
    }) => void;
    onQuickAddBlock?: (type: string) => void;
    onAddEdge: (src: string, srcPort: string, tgt: string, tgtPort: string) => void;
    onDeleteEdge: (id: string) => void;
    onUpdateStickyNote: (id: string, updates: Partial<StickyNote>) => void;
    onRemoveStickyNote: (id: string) => void;
}
declare function WorkflowCanvas({ blocks, edges, selectedBlockId, selectedBlockIds, blockStatuses, stickyNotes, onSelectBlock, onMoveBlock, onDropBlock, onQuickAddBlock, onAddEdge, onDeleteEdge, onUpdateStickyNote, onRemoveStickyNote }: WorkflowCanvasProps): react_jsx_runtime.JSX.Element;

interface WorkflowListProps {
    onOpenBuilder: (workflowId?: string) => void;
}
declare function WorkflowList({ onOpenBuilder }: WorkflowListProps): react_jsx_runtime.JSX.Element;

interface BlockPaletteProps {
    onDragStart: (blockType: string) => void;
}
declare function BlockPalette({ onDragStart }: BlockPaletteProps): react_jsx_runtime.JSX.Element;

interface BlockConfigPanelProps {
    block: CanvasBlock | null;
    onUpdate: (blockId: string, updates: Partial<CanvasBlock>) => void;
    onDelete: (blockId: string) => void;
    onClose: () => void;
}
declare function BlockConfigPanel({ block, onUpdate, onDelete, onClose }: BlockConfigPanelProps): react_jsx_runtime.JSX.Element;

interface SchemaBuilderProps {
    value: Record<string, unknown> | null;
    onChange: (schema: Record<string, unknown>) => void;
}
declare function SchemaBuilder({ value, onChange }: SchemaBuilderProps): react_jsx_runtime.JSX.Element;

interface GenerateWorkflowResult {
    name: string;
    description: string;
    graph: WorkflowGraph;
    validation_warnings?: string[];
}
interface WorkflowEditorAPI {
    list(): Promise<Workflow[]>;
    get(id: string): Promise<Workflow>;
    create(req: CreateWorkflowRequest): Promise<Workflow>;
    update(id: string, req: UpdateWorkflowRequest): Promise<Workflow>;
    delete(id: string): Promise<void>;
    run(id: string, inputs?: Record<string, unknown>): Promise<WorkflowRun>;
    validate(id: string): Promise<ValidationResult>;
    /** Generate a workflow from natural language (paid tier only). */
    generate?(prompt: string, model?: string): Promise<GenerateWorkflowResult>;
}
interface ButtonProps {
    variant?: "default" | "outline" | "ghost" | "destructive" | "danger" | "link";
    size?: "default" | "sm";
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
    type?: "button" | "submit";
}
interface InputProps {
    type?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    className?: string;
    placeholder?: string;
}
interface DialogProps {
    open: boolean;
    children: React.ReactNode;
}
interface DialogContentProps {
    onClose?: () => void;
    className?: string;
    children: React.ReactNode;
}
interface SimpleChildProps {
    className?: string;
    children: React.ReactNode;
}
interface AlertProps {
    variant?: "default" | "error";
    className?: string;
    children: React.ReactNode;
}
interface LoadingSpinnerProps {
    text?: string;
}
interface UIComponents {
    Button: React.ComponentType<ButtonProps>;
    Input: React.ComponentType<InputProps>;
    Dialog: React.ComponentType<DialogProps>;
    DialogContent: React.ComponentType<DialogContentProps>;
    DialogHeader: React.ComponentType<SimpleChildProps>;
    DialogTitle: React.ComponentType<SimpleChildProps>;
    DialogDescription: React.ComponentType<SimpleChildProps>;
    DialogFooter: React.ComponentType<SimpleChildProps>;
    LoadingSpinner: React.ComponentType<LoadingSpinnerProps>;
    Alert: React.ComponentType<AlertProps>;
    Card: React.ComponentType<SimpleChildProps>;
    CardContent: React.ComponentType<SimpleChildProps>;
    ErrorText: React.ComponentType<SimpleChildProps>;
}

interface WorkflowEditorProviderProps {
    /** Required: API adapter (WorkflowClient or custom implementation). */
    api: WorkflowEditorAPI;
    /** Optional: override any or all UI primitives. */
    ui?: Partial<UIComponents>;
    /** Optional: register additional custom block types for the editor palette. */
    customBlocks?: BlockTypeDefinition[];
    children: ReactNode;
}
declare function WorkflowEditorProvider({ api, ui, customBlocks, children, }: WorkflowEditorProviderProps): react_jsx_runtime.JSX.Element;
declare function useWorkflowAPI(): WorkflowEditorAPI;
declare function useWorkflowUI(): UIComponents;
declare function useBlockTypes(): BlockTypeDefinition[];

/**
 * Default UI primitives — plain HTML + CSS variables.
 * Consumers can override any component via WorkflowEditorProvider's `ui` prop.
 */

declare const DEFAULT_UI: UIComponents;

interface WorkflowEditorState {
    workflowId: string | null;
    name: string;
    blocks: CanvasBlock[];
    edges: CanvasEdge[];
}
/**
 * Convert an SDK Workflow to canvas editor state.
 */
declare function workflowToEditorState(workflow: Workflow): WorkflowEditorState;
/**
 * Convert canvas blocks/edges back to SDK WorkflowGraph format.
 */
declare function editorStateToGraph(blocks: CanvasBlock[], edges: CanvasEdge[]): WorkflowGraph;

/**
 * Example workflow compositions using the SDK builder.
 *
 * These demonstrate common patterns users can build with Schift blocks.
 * Each example can be passed directly to `schift.workflows.create()`.
 */
declare const basicRagIngest: CreateWorkflowRequest;
declare const ragQuery: CreateWorkflowRequest;
declare const contractAnalysis: CreateWorkflowRequest;
declare const conditionalRouting: CreateWorkflowRequest;
declare const invoiceTableExtraction: CreateWorkflowRequest;
declare const contractClauseExtractor: CreateWorkflowRequest;
declare const multiSourceRag: CreateWorkflowRequest;

export { type AlertProps, BLOCK_TYPES, type BlockCategory, BlockConfigPanel, BlockPalette, type BlockStatus, type BlockTypeDefinition, type ButtonProps, CATEGORY_ACCENT, CATEGORY_BADGE_COLORS, CATEGORY_COLORS, type CanvasBlock, type CanvasEdge, DEFAULT_UI, type DialogContentProps, type DialogProps, type GenerateWorkflowResult, type InputProps, type LoadingSpinnerProps, type PendingConnection, SchemaBuilder, type SimpleChildProps, type StickyNote, type UIComponents, WorkflowBuilder, WorkflowCanvas, WorkflowEditor, type WorkflowEditorAPI, type WorkflowEditorProps, WorkflowEditorProvider, type WorkflowEditorProviderProps, type WorkflowEditorState, WorkflowList, basicRagIngest, conditionalRouting, contractAnalysis, contractClauseExtractor, editorStateToGraph, getBlockTypeDef, invoiceTableExtraction, multiSourceRag, ragQuery, useBlockTypes, useWorkflowAPI, useWorkflowUI, workflowToEditorState };
