import type { Workflow, WorkflowGraph } from "../types.js";
import type { CanvasBlock, CanvasEdge } from "../types.js";

export interface WorkflowEditorState {
  workflowId: string | null;
  name: string;
  blocks: CanvasBlock[];
  edges: CanvasEdge[];
}

/**
 * Convert an SDK Workflow to canvas editor state.
 */
export function workflowToEditorState(workflow: Workflow): WorkflowEditorState {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    blocks: workflow.graph.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      config: { ...block.config },
      position: { x: block.position.x, y: block.position.y },
    })),
    edges: workflow.graph.edges.map((edge) => ({
      id: edge.id,
      sourceBlockId: edge.source,
      sourcePort: edge.source_handle ?? "out",
      targetBlockId: edge.target,
      targetPort: edge.target_handle ?? "in",
    })),
  };
}

/**
 * Convert canvas blocks/edges back to SDK WorkflowGraph format.
 */
export function editorStateToGraph(
  blocks: CanvasBlock[],
  edges: CanvasEdge[],
): WorkflowGraph {
  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type as import("../../workflow/types.js").BlockType,
      title: block.title,
      config: { ...block.config },
      position: { x: block.position.x, y: block.position.y },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceBlockId,
      target: edge.targetBlockId,
      source_handle: edge.sourcePort,
      target_handle: edge.targetPort,
    })),
  };
}
