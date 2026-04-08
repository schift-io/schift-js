/** Managed Agents SDK client — CRUD + Runs + SSE. */

import type { HttpTransport } from "../workflow/client.js";
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentResponse,
  CreateRunRequest,
  RunResponse,
  RunEvent,
} from "./types.js";

const BASE = "/v1/agents";

function toBody(obj: object): Record<string, unknown> {
  return obj as unknown as Record<string, unknown>;
}

function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    result[snakeKey] = v;
  }
  return result;
}

function toCamel<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = v;
  }
  return result as T;
}

export class AgentsClient {
  constructor(private readonly http: HttpTransport) {}

  async create(req: CreateAgentRequest): Promise<AgentResponse> {
    const raw = await this.http.post<Record<string, unknown>>(
      BASE,
      toSnake(toBody(req)),
    );
    return toCamel<AgentResponse>(raw);
  }

  async list(): Promise<AgentResponse[]> {
    const raw = await this.http.get<Record<string, unknown>[]>(BASE);
    return raw.map((r) => toCamel<AgentResponse>(r));
  }

  async get(id: string): Promise<AgentResponse> {
    const raw = await this.http.get<Record<string, unknown>>(`${BASE}/${id}`);
    return toCamel<AgentResponse>(raw);
  }

  async update(id: string, req: UpdateAgentRequest): Promise<AgentResponse> {
    const raw = await this.http.patch<Record<string, unknown>>(
      `${BASE}/${id}`,
      toSnake(toBody(req)),
    );
    return toCamel<AgentResponse>(raw);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`${BASE}/${id}`);
  }

  /** Get a RunsClient scoped to a specific agent. */
  runs(agentId: string): RunsClient {
    return new RunsClient(this.http, agentId);
  }
}

export class RunsClient {
  private readonly basePath: string;

  constructor(
    private readonly http: HttpTransport,
    agentId: string,
  ) {
    this.basePath = `${BASE}/${agentId}/runs`;
  }

  async create(req: CreateRunRequest): Promise<RunResponse> {
    const raw = await this.http.post<Record<string, unknown>>(
      this.basePath,
      toSnake(toBody(req)),
    );
    return toCamel<RunResponse>(raw);
  }

  async list(): Promise<RunResponse[]> {
    const raw = await this.http.get<Record<string, unknown>[]>(this.basePath);
    return raw.map((r) => toCamel<RunResponse>(r));
  }

  async get(runId: string): Promise<RunResponse> {
    const raw = await this.http.get<Record<string, unknown>>(
      `${this.basePath}/${runId}`,
    );
    return toCamel<RunResponse>(raw);
  }

  /**
   * Stream run events via SSE.
   *
   * @example
   * ```ts
   * const runs = schift.agents.runs("agt_abc123");
   * for await (const event of runs.streamEvents("run_xyz")) {
   *   if (event.eventType === "message") console.log(event.content);
   * }
   * ```
   */
  async *streamEvents(
    runId: string,
    afterSeq = 0,
  ): AsyncGenerator<RunEvent, void, unknown> {
    // SSE streaming requires direct fetch -- HttpTransport doesn't support streaming.
    // We delegate to the parent get() which returns the full URL, but for SSE
    // we need raw fetch. Expose via a convention: transport.get returns data,
    // but for streaming we use the events replay endpoint.
    const events = await this.http.get<Record<string, unknown>[]>(
      `${this.basePath}/${runId}/events?after_seq=${afterSeq}`,
    );
    // Fallback: if the response is a JSON array (non-streaming replay),
    // yield each event.
    if (Array.isArray(events)) {
      for (const ev of events) {
        yield toCamel<RunEvent>(ev);
      }
    }
  }
}
