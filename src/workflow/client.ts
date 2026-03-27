import type {
  Workflow,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  AddBlockRequest,
  AddEdgeRequest,
  RunWorkflowRequest,
  Block,
  Edge,
  WorkflowRun,
  ValidationResult,
  BlockTypeInfo,
  TemplateInfo,
  ListWorkflowsResponse,
  ListBlockTypesResponse,
  ListTemplatesResponse,
} from "./types.js";
import type { WorkflowDefinition } from "./yaml.js";
import {
  workflowFromYaml,
  workflowToYaml,
  definitionFromApiResponse,
  definitionToApiDict,
} from "./yaml.js";

/**
 * HTTP transport interface that the parent Schift client provides.
 * Keeps WorkflowClient decoupled from fetch details / auth headers.
 */
export interface HttpTransport {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: Record<string, unknown>): Promise<T>;
  patch<T>(path: string, body: Record<string, unknown>): Promise<T>;
  delete(path: string): Promise<void>;
}

const BASE = "/v1/workflows";

/** Cast an object to the generic record type expected by HttpTransport. */
function toBody(obj: object): Record<string, unknown> {
  return obj as unknown as Record<string, unknown>;
}

/** K-H4: Normalize backend "nodes" key to SDK "blocks" key in workflow graph. */
function normalizeWorkflow(wf: Workflow): Workflow {
  if (wf.graph && !wf.graph.blocks && wf.graph.nodes) {
    wf.graph.blocks = wf.graph.nodes;
  }
  return wf;
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
export class WorkflowClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  // ---- CRUD ----

  /**
   * Create a new workflow.
   */
  async create(request: CreateWorkflowRequest): Promise<Workflow> {
    const wf = await this.http.post<Workflow>(BASE, toBody(request));
    return normalizeWorkflow(wf);
  }

  /**
   * List all workflows in the current project/org.
   */
  async list(): Promise<Workflow[]> {
    // K-H3: Handle both {workflows: [...]} and bare array responses
    const resp = await this.http.get<ListWorkflowsResponse | Workflow[]>(BASE);
    const workflows = Array.isArray(resp) ? resp : resp.workflows;
    return workflows.map(normalizeWorkflow);
  }

  /**
   * Get a single workflow by ID.
   */
  async get(workflowId: string): Promise<Workflow> {
    const wf = await this.http.get<Workflow>(`${BASE}/${workflowId}`);
    return normalizeWorkflow(wf);
  }

  /**
   * Update a workflow (name, description, status, or full graph).
   */
  async update(
    workflowId: string,
    request: UpdateWorkflowRequest,
  ): Promise<Workflow> {
    const wf = await this.http.patch<Workflow>(
      `${BASE}/${workflowId}`,
      toBody(request),
    );
    return normalizeWorkflow(wf);
  }

  /**
   * Delete a workflow.
   */
  async delete(workflowId: string): Promise<void> {
    return this.http.delete(`${BASE}/${workflowId}`);
  }

  // ---- Blocks ----

  /**
   * Add a block to a workflow.
   */
  async addBlock(
    workflowId: string,
    request: AddBlockRequest,
  ): Promise<Block> {
    return this.http.post<Block>(
      `${BASE}/${workflowId}/blocks`,
      toBody(request),
    );
  }

  /**
   * Remove a block from a workflow.
   */
  async removeBlock(workflowId: string, blockId: string): Promise<void> {
    return this.http.delete(`${BASE}/${workflowId}/blocks/${blockId}`);
  }

  // ---- Edges ----

  /**
   * Add an edge between two blocks.
   */
  async addEdge(workflowId: string, request: AddEdgeRequest): Promise<Edge> {
    return this.http.post<Edge>(
      `${BASE}/${workflowId}/edges`,
      toBody(request),
    );
  }

  /**
   * Remove an edge from a workflow.
   */
  async removeEdge(workflowId: string, edgeId: string): Promise<void> {
    return this.http.delete(`${BASE}/${workflowId}/edges/${edgeId}`);
  }

  // ---- Execution ----

  /**
   * Execute a workflow with optional inputs.
   */
  async run(
    workflowId: string,
    inputs?: Record<string, unknown>,
  ): Promise<WorkflowRun> {
    const body: RunWorkflowRequest = { inputs };
    return this.http.post<WorkflowRun>(
      `${BASE}/${workflowId}/run`,
      toBody(body),
    );
  }

  /**
   * Validate a workflow graph (checks for cycles, missing connections, etc.).
   */
  async validate(workflowId: string): Promise<ValidationResult> {
    return this.http.post<ValidationResult>(
      `${BASE}/${workflowId}/validate`,
      {},
    );
  }

  // ---- Meta ----

  /**
   * List all available block types with their schemas.
   */
  async getBlockTypes(): Promise<BlockTypeInfo[]> {
    const resp = await this.http.get<ListBlockTypesResponse>(
      `${BASE}/meta/block-types`,
    );
    return resp.block_types;
  }

  /**
   * List available workflow templates.
   */
  async getTemplates(): Promise<TemplateInfo[]> {
    const resp = await this.http.get<ListTemplatesResponse>(
      `${BASE}/meta/templates`,
    );
    return resp.templates;
  }

  // ---- YAML Import / Export ----

  /**
   * Import a workflow from a YAML string. Creates a new workflow on the server.
   * Requires `js-yaml` to be installed.
   */
  async importYaml(yamlStr: string): Promise<Workflow> {
    const def = await workflowFromYaml(yamlStr);
    const body = definitionToApiDict(def);
    const wf = await this.http.post<Workflow>(BASE, body);
    return normalizeWorkflow(wf);
  }

  /**
   * Export a workflow as a YAML string.
   * Requires `js-yaml` to be installed.
   */
  async exportYaml(workflowId: string): Promise<string> {
    const wf = await this.get(workflowId);
    const def = definitionFromApiResponse(
      wf as unknown as Record<string, unknown>,
    );
    return workflowToYaml(def);
  }

  // ---- Runs ----

  /**
   * List all runs for a workflow.
   */
  async listRuns(workflowId: string): Promise<any[]> {
    return this.http.get(`${BASE}/${workflowId}/runs`);
  }

  /**
   * Get a specific run by ID.
   */
  async getRun(workflowId: string, runId: string): Promise<any> {
    return this.http.get(`${BASE}/${workflowId}/runs/${runId}`);
  }

  // ---- Generation ----

  /**
   * Generate text using the workflow's LLM configuration.
   */
  async generate(prompt: string, model?: string): Promise<any> {
    return this.http.post(`${BASE}/generate`, { prompt, model });
  }
}
