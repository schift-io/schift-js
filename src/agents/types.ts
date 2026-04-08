/** Managed Agents — request/response types. */

export interface CreateAgentRequest {
  name: string;
  model?: string;
  instructions?: string;
  tools?: AgentToolDef[];
  ragConfig?: RagConfig;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentRequest {
  name?: string;
  model?: string;
  instructions?: string;
  tools?: AgentToolDef[];
  ragConfig?: RagConfig;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  id: string;
  orgId: string;
  name: string;
  model: string;
  instructions: string;
  tools: AgentToolDef[];
  ragConfig: RagConfig;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunRequest {
  message: string;
}

export interface RunResponse {
  id: string;
  agentId: string;
  orgId: string;
  status: "pending" | "running" | "success" | "error" | "timeout";
  inputText: string;
  outputText?: string;
  error?: string;
  tokensUsed: number;
  durationMs?: number;
  createdAt: string;
  finishedAt?: string;
}

export interface RunEvent {
  seq: number;
  eventType: string;
  [key: string]: unknown;
}

export interface RagConfig {
  bucketId?: string;
  topK?: number;
}

export interface AgentToolDef {
  name: string;
  description?: string;
}
