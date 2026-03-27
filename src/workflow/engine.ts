/**
 * Local workflow execution engine for the Schift TypeScript SDK.
 *
 * Runs WorkflowDefinition DAGs locally, delegating API calls
 * through the Schift client. Supports custom node registration.
 *
 * Usage:
 *
 *   import { WorkflowRunner } from "@schift-io/sdk";
 *   import { workflowFromYaml } from "@schift-io/sdk";
 *
 *   const def = await workflowFromYaml(yamlStr);
 *   const runner = new WorkflowRunner(def);
 *   const result = await runner.run({ query: "hello" });
 */

import type { WorkflowDefinition, BlockDef, EdgeDef } from "./yaml.js";
import { validateDefinition } from "./yaml.js";
import { getNodeHandler } from "./nodes.js";
import type { SDKExecutionContext } from "./nodes.js";

// ---- Context & Result Types ----

function generateRunId(): string {
  const chars = "abcdef0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export class ExecutionContext implements SDKExecutionContext {
  client?: unknown;
  runId: string;
  variables: Record<string, unknown>;

  constructor(opts?: {
    client?: unknown;
    runId?: string;
    variables?: Record<string, unknown>;
  }) {
    this.client = opts?.client;
    this.runId = opts?.runId ?? generateRunId();
    this.variables = { ...(opts?.variables ?? {}) };
  }

  getVar(key: string, defaultValue?: unknown): unknown {
    return this.variables[key] ?? defaultValue;
  }

  setVar(key: string, value: unknown): void {
    this.variables[key] = value;
  }
}

export interface BlockRunResult {
  blockId: string;
  status: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface WorkflowRunResult {
  runId: string;
  status: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  blockStates: Record<string, BlockRunResult>;
  error?: string;
  startedAt: string;
  finishedAt: string;
}

// ---- Internal Async Engine ----

class Engine {
  private readonly definition: WorkflowDefinition;
  private readonly client?: unknown;
  private readonly adjacency = new Map<string, EdgeDef[]>();
  private readonly reverse = new Map<string, EdgeDef[]>();
  private readonly blocks = new Map<string, BlockDef>();

  constructor(definition: WorkflowDefinition, client?: unknown) {
    this.definition = definition;
    this.client = client;

    for (const block of definition.blocks) {
      this.blocks.set(block.id, block);
    }
    for (const edge of definition.edges) {
      if (!this.adjacency.has(edge.source)) {
        this.adjacency.set(edge.source, []);
      }
      this.adjacency.get(edge.source)!.push(edge);

      if (!this.reverse.has(edge.target)) {
        this.reverse.set(edge.target, []);
      }
      this.reverse.get(edge.target)!.push(edge);
    }
  }

  async run(
    inputs?: Record<string, unknown>,
  ): Promise<WorkflowRunResult> {
    const ctx = new ExecutionContext({
      client: this.client,
      variables: inputs ? { ...inputs } : {},
    });

    const result: WorkflowRunResult = {
      runId: ctx.runId,
      inputs: inputs ?? {},
      outputs: {},
      blockStates: {},
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: "",
    };

    try {
      const order = this.topoSort();
      const blockOutputs = new Map<string, Record<string, unknown>>();
      let allCompleted = true;

      for (const blockId of order) {
        const block = this.blocks.get(blockId)!;

        const resolvedInputs = this.resolveInputs(blockId, blockOutputs, ctx);

        // Skip blocks on inactive condition branches
        if (this.isSkipped(blockId, blockOutputs)) {
          const state: BlockRunResult = {
            blockId,
            status: "completed",
            inputs: {},
            outputs: { _skipped: true },
            durationMs: 0,
          };
          result.blockStates[blockId] = state;
          blockOutputs.set(blockId, state.outputs);
          continue;
        }

        // Notify blocks are not executed by the DAG
        if (block.type === "notify") {
          const state: BlockRunResult = {
            blockId,
            status: "completed",
            inputs: {},
            outputs: { _skipped: true },
            durationMs: 0,
          };
          result.blockStates[blockId] = state;
          blockOutputs.set(blockId, state.outputs);
          continue;
        }

        // Execute block
        const handler = getNodeHandler(block);
        const t0 = performance.now();
        const state: BlockRunResult = {
          blockId,
          status: "running",
          inputs: resolvedInputs,
          outputs: {},
          durationMs: 0,
        };

        try {
          const outputs = await handler.execute(resolvedInputs, ctx);
          state.outputs = outputs;
          state.status = "completed";
        } catch (exc) {
          state.error = String(exc instanceof Error ? exc.message : exc);
          state.status = "failed";
        }
        state.durationMs = Math.round(performance.now() - t0);

        result.blockStates[blockId] = state;
        blockOutputs.set(blockId, state.outputs);

        if (state.status === "failed") {
          allCompleted = false;
          result.status = "failed";
          result.error = `Block '${block.title ?? block.id}' failed: ${state.error}`;
          break;
        }

        // Publish outputs as context variables
        for (const [key, value] of Object.entries(state.outputs)) {
          ctx.setVar(`${blockId}.${key}`, value);
        }
      }

      if (allCompleted) {
        result.status = "completed";
      }

      result.outputs = this.collectOutputs(blockOutputs);
    } catch (exc) {
      result.status = "failed";
      result.error = String(exc instanceof Error ? exc.message : exc);
    }

    result.finishedAt = new Date().toISOString();
    return result;
  }

  // -- DAG helpers --

  private topoSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const bid of this.blocks.keys()) {
      inDegree.set(bid, 0);
    }
    for (const edge of this.definition.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [bid, deg] of inDegree) {
      if (deg === 0) queue.push(bid);
    }

    const order: string[] = [];
    while (queue.length) {
      const node = queue.shift()!;
      order.push(node);
      for (const edge of this.adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(edge.target) ?? 1) - 1;
        inDegree.set(edge.target, newDeg);
        if (newDeg === 0) queue.push(edge.target);
      }
    }

    if (order.length !== this.blocks.size) {
      throw new Error("Workflow contains a cycle — not a valid DAG");
    }

    return order;
  }

  private resolveInputs(
    blockId: string,
    blockOutputs: Map<string, Record<string, unknown>>,
    ctx: ExecutionContext,
  ): Record<string, unknown> {
    const block = this.blocks.get(blockId)!;
    if (block.type === "start") {
      return { ...ctx.variables };
    }

    const inputs: Record<string, unknown> = {};
    for (const edge of this.reverse.get(blockId) ?? []) {
      const upstreamOutputs = blockOutputs.get(edge.source) ?? {};
      if ((edge.source_handle ?? "output") === "output") {
        Object.assign(inputs, upstreamOutputs);
      } else {
        inputs[edge.source_handle!] = upstreamOutputs;
      }
    }

    return inputs;
  }

  private isSkipped(
    blockId: string,
    blockOutputs: Map<string, Record<string, unknown>>,
  ): boolean {
    for (const edge of this.reverse.get(blockId) ?? []) {
      const upstreamOutputs = blockOutputs.get(edge.source) ?? {};
      const branch = upstreamOutputs.branch;
      if (branch != null) {
        const expected = edge.source_handle;
        if (branch !== expected) {
          return true;
        }
      }
    }
    return false;
  }

  private collectOutputs(
    blockOutputs: Map<string, Record<string, unknown>>,
  ): Record<string, unknown> {
    const final: Record<string, unknown> = {};

    // Collect from END blocks
    for (const [blockId, block] of this.blocks) {
      if (block.type === "end") {
        const out = blockOutputs.get(blockId) ?? {};
        Object.assign(final, out);
      }
    }

    if (Object.keys(final).length > 0) {
      return final;
    }

    // Fallback: blocks with no downstream edges
    const sources = new Set<string>();
    for (const edge of this.definition.edges) {
      sources.add(edge.source);
    }
    for (const blockId of this.blocks.keys()) {
      if (!sources.has(blockId)) {
        const out = blockOutputs.get(blockId) ?? {};
        Object.assign(final, out);
      }
    }

    return final;
  }
}

// ---- Public API ----

/**
 * Async workflow runner.
 *
 * Usage:
 *
 *   const runner = new WorkflowRunner(definition, client);
 *   const result = await runner.run({ query: "hello" });
 *   console.log(result.status, result.outputs);
 */
export class WorkflowRunner {
  private readonly engine: Engine;

  constructor(definition: WorkflowDefinition, client?: unknown) {
    this.engine = new Engine(definition, client);
  }

  async run(
    inputs?: Record<string, unknown>,
  ): Promise<WorkflowRunResult> {
    return this.engine.run(inputs);
  }

  validate(): string[] {
    return validateDefinition(
      (this.engine as unknown as { definition: WorkflowDefinition }).definition,
    );
  }
}
