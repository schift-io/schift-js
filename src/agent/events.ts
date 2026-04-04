export type AgentEventMap = {
  agent_start: {
    type: "agent_start";
    runId: string;
    timestamp: number;
    input: string;
  };
  turn_start: {
    type: "turn_start";
    runId: string;
    timestamp: number;
    turnIndex: number;
  };
  tool_call: {
    type: "tool_call";
    runId: string;
    timestamp: number;
    toolName: string;
    toolArgs: Record<string, unknown>;
    callId: string;
  };
  tool_result: {
    type: "tool_result";
    runId: string;
    timestamp: number;
    toolName: string;
    callId: string;
    result: unknown;
    durationMs: number;
  };
  message_delta: {
    type: "message_delta";
    runId: string;
    timestamp: number;
    content: string;
  };
  agent_end: {
    type: "agent_end";
    runId: string;
    timestamp: number;
    output: string;
    totalDurationMs: number;
  };
  error: {
    type: "error";
    runId: string;
    timestamp: number;
    error: unknown;
  };
  policy_violation: {
    type: "policy_violation";
    runId: string;
    timestamp: number;
    skillName: string;
    stage: "before_tool" | "after_tool" | "procedure" | "constraint";
    reason: string;
    toolName?: string;
  };
};

export type AgentEventType = keyof AgentEventMap;
export type AgentEvent = AgentEventMap[AgentEventType];
export type AgentWildcardEvent = AgentEvent | (AgentEvent & { type: AgentEventType });

type EventHandler<K extends AgentEventType> = (event: AgentEventMap[K]) => void;
type WildcardHandler = (event: AgentWildcardEvent) => void;

export class AgentEventEmitter {
  private readonly handlers = new Map<AgentEventType, Set<(event: AgentEvent) => void>>();
  private readonly wildcardHandlers = new Set<WildcardHandler>();

  on<K extends AgentEventType>(type: K, handler: EventHandler<K>): () => void;
  on(type: "*", handler: WildcardHandler): () => void;
  on(type: AgentEventType | "*", handler: ((event: AgentEvent) => void) | WildcardHandler): () => void {
    if (type === "*") {
      this.wildcardHandlers.add(handler as WildcardHandler);
      return () => this.off("*", handler as WildcardHandler);
    }

    const set = this.handlers.get(type) ?? new Set<(event: AgentEvent) => void>();
    set.add(handler as (event: AgentEvent) => void);
    this.handlers.set(type, set);
    return () => this.off(type, handler as (event: AgentEvent) => void);
  }

  off<K extends AgentEventType>(type: K, handler: EventHandler<K>): void;
  off(type: "*", handler: WildcardHandler): void;
  off(type: AgentEventType | "*", handler: ((event: AgentEvent) => void) | WildcardHandler): void {
    if (type === "*") {
      this.wildcardHandlers.delete(handler as WildcardHandler);
      return;
    }

    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(handler as (event: AgentEvent) => void);
    if (set.size === 0) {
      this.handlers.delete(type);
    }
  }

  emit(event: AgentEvent): void {
    const typedHandlers = this.handlers.get(event.type);
    if (typedHandlers) {
      for (const handler of typedHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error("AgentEventEmitter handler error:", err);
        }
      }
    }

    for (const handler of this.wildcardHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("AgentEventEmitter wildcard handler error:", err);
      }
    }
  }

  removeAll(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}
