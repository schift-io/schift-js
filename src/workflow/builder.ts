import type {
  BlockType,
  BlockConfig,
  Position,
  Block,
  Edge,
  WorkflowGraph,
  CreateWorkflowRequest,
} from "./types.js";

// ---- Builder Block Descriptor ----

export interface BlockDescriptor {
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
export class WorkflowBuilder {
  private readonly _name: string;
  private _description: string;
  private _blocks = new Map<string, Block>();
  private _edges: Edge[] = [];
  private _autoX = 0;
  private _autoY = 0;
  private _edgeCounter = 0;

  constructor(name: string) {
    this._name = name;
    this._description = "";
  }

  /**
   * Set the workflow description.
   */
  description(desc: string): this {
    this._description = desc;
    return this;
  }

  /**
   * Add a block to the workflow.
   *
   * @param alias - A local identifier used for connecting blocks. This becomes
   *   the block's `id` in the built graph.
   * @param descriptor - Block type, optional title, position, and config.
   *   If `type` is omitted it defaults to the alias string (e.g. alias "start"
   *   maps to type "start").
   */
  addBlock(alias: string, descriptor: BlockDescriptor = {}): this {
    const blockType = (descriptor.type ?? alias) as BlockType;
    const title = descriptor.title ?? alias;
    const position = descriptor.position ?? this.nextPosition();

    this._blocks.set(alias, {
      id: alias,
      type: blockType,
      title,
      position,
      config: descriptor.config ?? {},
    });

    return this;
  }

  /**
   * Connect two blocks with an edge.
   *
   * @param source - Alias of the source block.
   * @param target - Alias of the target block.
   * @param sourceHandle - Optional output handle name.
   * @param targetHandle - Optional input handle name.
   */
  connect(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
  ): this {
    if (!this._blocks.has(source)) {
      throw new Error(
        `WorkflowBuilder: source block "${source}" not found. ` +
          `Add it with .addBlock("${source}", ...) first.`,
      );
    }
    if (!this._blocks.has(target)) {
      throw new Error(
        `WorkflowBuilder: target block "${target}" not found. ` +
          `Add it with .addBlock("${target}", ...) first.`,
      );
    }

    this._edgeCounter++;
    const edge: Edge = {
      id: `edge_${this._edgeCounter}`,
      source,
      target,
    };
    if (sourceHandle) edge.source_handle = sourceHandle;
    if (targetHandle) edge.target_handle = targetHandle;

    this._edges.push(edge);
    return this;
  }

  /**
   * Return the constructed graph without the name/description wrapper.
   */
  buildGraph(): WorkflowGraph {
    return {
      blocks: Array.from(this._blocks.values()),
      edges: [...this._edges],
    };
  }

  /**
   * Build a CreateWorkflowRequest ready to pass to `WorkflowClient.create()`.
   */
  build(): CreateWorkflowRequest {
    return {
      name: this._name,
      description: this._description || undefined,
      graph: this.buildGraph(),
    };
  }

  // ---- internal helpers ----

  private nextPosition(): Position {
    const pos = { x: this._autoX, y: this._autoY };
    this._autoY += 120;
    return pos;
  }
}
