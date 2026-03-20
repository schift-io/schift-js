type Modality = "text" | "image" | "audio" | "video" | "document";
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" | "CLASSIFICATION" | "CLUSTERING" | "QUESTION_ANSWERING" | "FACT_VERIFICATION" | "CODE_RETRIEVAL";
interface SchiftConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}
interface EmbedRequest {
    /** Single text to embed. Use `texts` for batch requests. */
    text: string;
    model?: string;
    dimensions?: number;
}
interface EmbedBatchRequest {
    /** Array of texts to embed in one request. */
    texts: string[];
    model?: string;
    dimensions?: number;
}
interface EmbedResponse {
    embedding: number[];
    model: string;
    dimensions: number;
    usage: {
        tokens: number;
    };
}
interface EmbedBatchResponse {
    embeddings: number[][];
    model: string;
    dimensions: number;
    usage: {
        tokens: number;
        count: number;
    };
}
interface SearchRequest {
    query: string;
    collection: string;
    topK?: number;
    modalities?: Modality[];
}
interface SearchResult {
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
interface ProjectRequest {
    vectors: number[][];
    source: string;
    targetDimensions?: number;
}
interface ProjectResponse {
    vectors: number[][];
    source: string;
    target: string;
    dimensions: number;
}
interface FileUploadResponse {
    fileId: string;
    filename: string;
    bytes: number;
    mimeType: string;
    status: "processing" | "ready" | "error";
}
interface BucketUploadResult {
    bucket_id: string;
    bucket_name: string;
    /** Per-file results returned by the server. */
    uploaded: unknown[];
}
interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}
interface ChatRequest {
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
interface ChatSource {
    id: string;
    score: number;
    text: string;
}
interface ChatResponse {
    reply: string;
    sources: ChatSource[];
    model: string;
}
interface ChatStreamEvent {
    type: "sources" | "chunk" | "done" | "error";
    sources?: ChatSource[];
    content?: string;
    message?: string;
}

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
interface BlockTypeInfo {
    type: BlockType;
    label: string;
    description: string;
    category: string;
    default_config: BlockConfig;
    input_handles: string[];
    output_handles: string[];
}
interface TemplateInfo {
    id: WorkflowTemplate;
    name: string;
    description: string;
    graph: WorkflowGraph;
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
interface AddBlockRequest {
    type: BlockType;
    title?: string;
    position?: Position;
    config?: BlockConfig;
}
interface AddEdgeRequest {
    source: string;
    target: string;
    source_handle?: string;
    target_handle?: string;
}
interface RunWorkflowRequest {
    inputs?: Record<string, unknown>;
}
interface ListWorkflowsResponse {
    workflows: Workflow[];
}
interface ListBlockTypesResponse {
    block_types: BlockTypeInfo[];
}
interface ListTemplatesResponse {
    templates: TemplateInfo[];
}

/**
 * HTTP transport interface that the parent Schift client provides.
 * Keeps WorkflowClient decoupled from fetch details / auth headers.
 */
interface HttpTransport {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: Record<string, unknown>): Promise<T>;
    patch<T>(path: string, body: Record<string, unknown>): Promise<T>;
    delete(path: string): Promise<void>;
}
/**
 * Client for the Schift Workflow API.
 *
 * Not instantiated directly -- access via `schift.workflows`.
 *
 * @example
 * ```ts
 * const schift = new Schift({ apiKey: "sch_xxx" });
 *
 * // Create
 * const wf = await schift.workflows.create({ name: "My Pipeline" });
 *
 * // Add blocks
 * const block = await schift.workflows.addBlock(wf.id, {
 *   type: "document_loader",
 *   title: "Load docs",
 * });
 *
 * // Run
 * const run = await schift.workflows.run(wf.id, { query: "hello" });
 * ```
 */
declare class WorkflowClient {
    private readonly http;
    constructor(http: HttpTransport);
    /**
     * Create a new workflow.
     */
    create(request: CreateWorkflowRequest): Promise<Workflow>;
    /**
     * List all workflows in the current project/org.
     */
    list(): Promise<Workflow[]>;
    /**
     * Get a single workflow by ID.
     */
    get(workflowId: string): Promise<Workflow>;
    /**
     * Update a workflow (name, description, status, or full graph).
     */
    update(workflowId: string, request: UpdateWorkflowRequest): Promise<Workflow>;
    /**
     * Delete a workflow.
     */
    delete(workflowId: string): Promise<void>;
    /**
     * Add a block to a workflow.
     */
    addBlock(workflowId: string, request: AddBlockRequest): Promise<Block>;
    /**
     * Remove a block from a workflow.
     */
    removeBlock(workflowId: string, blockId: string): Promise<void>;
    /**
     * Add an edge between two blocks.
     */
    addEdge(workflowId: string, request: AddEdgeRequest): Promise<Edge>;
    /**
     * Remove an edge from a workflow.
     */
    removeEdge(workflowId: string, edgeId: string): Promise<void>;
    /**
     * Execute a workflow with optional inputs.
     */
    run(workflowId: string, inputs?: Record<string, unknown>): Promise<WorkflowRun>;
    /**
     * Validate a workflow graph (checks for cycles, missing connections, etc.).
     */
    validate(workflowId: string): Promise<ValidationResult>;
    /**
     * List all available block types with their schemas.
     */
    getBlockTypes(): Promise<BlockTypeInfo[]>;
    /**
     * List available workflow templates.
     */
    getTemplates(): Promise<TemplateInfo[]>;
}

declare class Schift {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    /**
     * Workflow sub-client for building and running RAG pipelines.
     *
     * @example
     * ```ts
     * const wf = await client.workflows.create({ name: "My RAG" });
     * const run = await client.workflows.run(wf.id, { query: "hello" });
     * ```
     */
    readonly workflows: WorkflowClient;
    /**
     * DB sub-module for bucket and document management.
     *
     * @example
     * ```ts
     * const result = await client.db.upload("my-docs", {
     *   files: [new File([pdfBytes], "manual.pdf")],
     * });
     * ```
     */
    readonly db: {
        upload(bucket: string, options: {
            files: File[] | Blob[];
        }): Promise<BucketUploadResult>;
    };
    constructor(config: SchiftConfig);
    /** Embed a single text string. */
    embed(request: EmbedRequest): Promise<EmbedResponse>;
    /** Embed multiple texts in a single request. */
    embedBatch(request: EmbedBatchRequest): Promise<EmbedBatchResponse>;
    search(request: SearchRequest): Promise<SearchResult[]>;
    /**
     * RAG Chat — search bucket + generate answer in one call.
     *
     * @example
     * ```ts
     * const result = await client.chat({
     *   bucketId: "my-bucket",
     *   message: "how do I reset my password?",
     * });
     * console.log(result.reply, result.sources);
     * ```
     */
    chat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * RAG Chat with SSE streaming.
     * Returns an async iterator of ChatStreamEvent.
     *
     * @example
     * ```ts
     * for await (const event of client.chatStream({
     *   bucketId: "my-bucket",
     *   message: "summarize the Q4 report",
     * })) {
     *   if (event.type === "sources") console.log(event.sources);
     *   if (event.type === "chunk") process.stdout.write(event.content ?? "");
     *   if (event.type === "done") console.log("\n--- done ---");
     * }
     * ```
     */
    chatStream(request: ChatRequest): AsyncGenerator<ChatStreamEvent>;
    /**
     * @deprecated Not yet available on the server.
     * Use the Python SDK for projection until this endpoint is released.
     */
    project(_request: ProjectRequest): Promise<ProjectResponse>;
    /**
     * Upload files to a named bucket. Creates the bucket if it does not exist.
     *
     * @example
     * ```ts
     * const result = await client.db.upload("my-docs", {
     *   files: [new File([pdfBytes], "manual.pdf", { type: "application/pdf" })],
     * });
     * console.log(result.bucket_id, result.uploaded);
     * ```
     */
    private _dbUpload;
    listCollections(): Promise<any[]>;
    getCollection(collectionId: string): Promise<any>;
    deleteCollection(collectionId: string): Promise<void>;
    /**
     * @deprecated Not yet available on the server.
     */
    uploadFile(_file: Blob, _filename: string): Promise<FileUploadResponse>;
    /**
     * @deprecated Not yet available on the server.
     */
    getFile(_fileId: string): Promise<FileUploadResponse>;
    /**
     * @deprecated Not yet available on the server.
     */
    deleteFile(_fileId: string): Promise<void>;
    private post;
    private get;
    private patch;
    private del;
    private request;
    private handleResponse;
    private throwError;
}

declare class SchiftError extends Error {
    readonly status?: number;
    readonly code?: string;
    constructor(message: string, status?: number, code?: string);
}
declare class AuthError extends SchiftError {
    constructor(message?: string);
}
declare class QuotaError extends SchiftError {
    constructor(message?: string);
}

interface BlockDescriptor {
    type?: BlockType;
    title?: string;
    position?: Position;
    config?: BlockConfig;
}
/**
 * Fluent builder for constructing WorkflowGraph objects locally
 * before sending them to the API via WorkflowClient.create().
 *
 * @example
 * ```ts
 * const request = new WorkflowBuilder("My RAG Pipeline")
 *   .description("A simple RAG workflow")
 *   .addBlock("start", { type: "start", title: "Start" })
 *   .addBlock("loader", { type: "document_loader", config: { source_type: "upload" } })
 *   .addBlock("chunker", { type: "chunker", config: { strategy: "recursive", chunk_size: 512 } })
 *   .addBlock("embedder", { type: "embedder" })
 *   .addBlock("end", { type: "end" })
 *   .connect("start", "loader")
 *   .connect("loader", "chunker")
 *   .connect("chunker", "embedder")
 *   .connect("embedder", "end")
 *   .build();
 * ```
 */
declare class WorkflowBuilder {
    private readonly _name;
    private _description;
    private _blocks;
    private _edges;
    private _autoX;
    private _autoY;
    private _edgeCounter;
    constructor(name: string);
    /**
     * Set the workflow description.
     */
    description(desc: string): this;
    /**
     * Add a block to the workflow.
     *
     * @param alias - A local identifier used for connecting blocks. This becomes
     *   the block's `id` in the built graph.
     * @param descriptor - Block type, optional title, position, and config.
     *   If `type` is omitted it defaults to the alias string (e.g. alias "start"
     *   maps to type "start").
     */
    addBlock(alias: string, descriptor?: BlockDescriptor): this;
    /**
     * Connect two blocks with an edge.
     *
     * @param source - Alias of the source block.
     * @param target - Alias of the target block.
     * @param sourceHandle - Optional output handle name.
     * @param targetHandle - Optional input handle name.
     */
    connect(source: string, target: string, sourceHandle?: string, targetHandle?: string): this;
    /**
     * Return the constructed graph without the name/description wrapper.
     */
    buildGraph(): WorkflowGraph;
    /**
     * Build a CreateWorkflowRequest ready to pass to `WorkflowClient.create()`.
     */
    build(): CreateWorkflowRequest;
    private nextPosition;
}

export { type AddBlockRequest, type AddEdgeRequest, AuthError, type Block, type BlockConfig, type BlockDescriptor, type BlockRunState, BlockRunStatus, BlockType, type BlockTypeInfo, type CreateWorkflowRequest, type Edge, type EmbedBatchRequest, type EmbedBatchResponse, type EmbedRequest, type EmbedResponse, type FileUploadResponse, type HttpTransport, type ListBlockTypesResponse, type ListTemplatesResponse, type ListWorkflowsResponse, type Modality, type Position, type ProjectRequest, type ProjectResponse, QuotaError, RunStatus, type RunWorkflowRequest, Schift, type SchiftConfig, SchiftError, type SearchRequest, type SearchResult, type TaskType, type TemplateInfo, type UpdateWorkflowRequest, type ValidationError, type ValidationResult, type Workflow, WorkflowBuilder, WorkflowClient, type WorkflowGraph, type WorkflowRun, WorkflowStatus, WorkflowTemplate };
