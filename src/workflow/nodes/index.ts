/**
 * Node handlers for the SDK workflow execution engine.
 *
 * Tier 1 -- fully local execution (control, logic, transform).
 * Tier 2 -- delegates to Schift API or external LLM APIs.
 * Tier 3 -- server-only stubs (throw Error).
 *
 * Custom nodes:
 *
 *   import { SDKBaseNode, registerCustomNode } from "@schift-io/sdk";
 *
 *   class SentimentNode extends SDKBaseNode {
 *     async execute(inputs, ctx) {
 *       return { score: 0.9, label: "positive" };
 *     }
 *   }
 *
 *   registerCustomNode("sentiment_analyzer", SentimentNode);
 */

import type { BlockDef } from "../yaml.js";

// ---- Re-exports ----

export { SDKBaseNode } from "./base.js";
export type { SDKExecutionContext } from "./base.js";

// ---- Tier 1: Control ----
import { StartNode, EndNode, PassthroughNode } from "./control.js";

// ---- Tier 1: Logic ----
import { ConditionNode, MergeNode, LoopNode, RouterNode } from "./logic.js";

// ---- Tier 1: Transform ----
import {
  VariableNode,
  PromptTemplateNode,
  AnswerNode,
  FieldSelectorNode,
  ModelSelectorNode,
} from "./transform.js";

// ---- Tier 2: Schift API ----
import {
  EmbedderNode,
  RetrieverNode,
  RerankerNode,
  VectorStoreNode,
  CollectionNode,
} from "./api.js";

// ---- Tier 2: LLM ----
import { LLMNode, MetadataExtractorNode } from "./llm.js";

// ---- Tier 2: Web Search ----
import { WebSearchNode } from "./web-search.js";

// ---- Tier 3: Server-only ----
import { ServerOnlyNode } from "./server-only.js";

// ---- Tier 1: n8n-derived helpers ----
import {
  SetNode,
  FilterNode,
  SwitchNode,
  AggregateNode,
  SortNode,
  LimitNode,
  SplitOutNode,
  SummarizeNode,
  RemoveDuplicatesNode,
  DateTimeNode,
  WaitNode,
  ScheduleTriggerNode,
  ManualTriggerNode,
  HumanApprovalNode,
  HumanFormNode,
  DecisionReviewNode,
} from "./transform-extras.js";

// ---- Registry ----

import { SDKBaseNode } from "./base.js";

const BUILTIN_HANDLERS: Record<string, new (block: BlockDef) => SDKBaseNode> = {
  // Tier 1 -- Control
  start: StartNode,
  end: EndNode,
  // Tier 1 -- Logic
  condition: ConditionNode,
  router: RouterNode,
  loop: LoopNode,
  merge: MergeNode,
  // Tier 1 -- Transform / Output
  variable: VariableNode,
  prompt_template: PromptTemplateNode,
  answer: AnswerNode,
  field_selector: FieldSelectorNode,
  model_selector: ModelSelectorNode,
  // Tier 2 -- Schift API
  embedder: EmbedderNode,
  retriever: RetrieverNode,
  reranker: RerankerNode,
  vector_store: VectorStoreNode,
  collection: CollectionNode,
  // Tier 2 -- External LLM
  llm: LLMNode,
  metadata_extractor: MetadataExtractorNode,
  // Tier 2 -- Web Search
  web_search: WebSearchNode,
  // Tier 3 -- Server-only
  ai_router: ServerOnlyNode,
  document_loader: ServerOnlyNode,
  document_parser: ServerOnlyNode,
  chunker: ServerOnlyNode,
  code: ServerOnlyNode,
  http_request: ServerOnlyNode,
  webhook: ServerOnlyNode,
  webhook_source: ServerOnlyNode,
  ingest_bridge: ServerOnlyNode,
  feed_poll: ServerOnlyNode,
  notify: PassthroughNode,
  // Tier 1 -- n8n-derived helpers
  set: SetNode,
  filter: FilterNode,
  switch: SwitchNode,
  aggregate: AggregateNode,
  sort: SortNode,
  limit: LimitNode,
  split_out: SplitOutNode,
  summarize: SummarizeNode,
  remove_duplicates: RemoveDuplicatesNode,
  datetime: DateTimeNode,
  wait: WaitNode,
  schedule_trigger: ScheduleTriggerNode,
  manual_trigger: ManualTriggerNode,
  human_approval: HumanApprovalNode,
  human_form: HumanFormNode,
  decision_review: DecisionReviewNode,
};

const CUSTOM_NODES: Record<
  string,
  new (block: BlockDef) => SDKBaseNode
> = {};

/**
 * Register a custom node handler.
 *
 * @param blockType - Unique type identifier (e.g. "sentiment_analyzer").
 * @param handlerCls - A class extending SDKBaseNode.
 * @throws if the type collides with a built-in type.
 */
export function registerCustomNode(
  blockType: string,
  handlerCls: new (block: BlockDef) => SDKBaseNode,
): void {
  if (blockType in BUILTIN_HANDLERS) {
    throw new Error(
      `Cannot override built-in block type '${blockType}'. ` +
        "Choose a unique type name for your custom node.",
    );
  }
  CUSTOM_NODES[blockType] = handlerCls;
}

/**
 * Remove a previously registered custom node.
 */
export function unregisterCustomNode(blockType: string): void {
  delete CUSTOM_NODES[blockType];
}

/**
 * Instantiate the correct node handler for a block.
 * Checks custom nodes first, then falls back to built-in types.
 * Unknown types get PassthroughNode.
 */
export function getNodeHandler(block: BlockDef): SDKBaseNode {
  if (block.type in CUSTOM_NODES) {
    return new CUSTOM_NODES[block.type](block);
  }
  const Cls = BUILTIN_HANDLERS[block.type] ?? PassthroughNode;
  return new Cls(block);
}

export { SDKBaseNode as SDKBaseNodeClass };
