import type { AgentTool, ToolResult, JSONSchema } from "./types.js";

const TOOL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Registry of tools available to an agent. */
export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  /** Register a tool. Throws on duplicate or invalid name. */
  register(tool: AgentTool): void {
    if (!TOOL_NAME_RE.test(tool.name)) {
      throw new Error(`invalid tool name: "${tool.name}". Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`);
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Get a tool by name. Returns undefined if not found. */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tools. */
  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  /** Execute a tool by name with given args. Catches handler errors. */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }
    try {
      return await tool.handler(args);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Generate OpenAI-compatible tool definitions. */
  toOpenAI(): Array<{
    type: "function";
    function: { name: string; description: string; parameters?: JSONSchema };
  }> {
    return this.list().map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        ...(t.parameters ? { parameters: t.parameters } : {}),
      },
    }));
  }

  /** Generate Anthropic-compatible tool definitions. */
  toAnthropic(): Array<{
    name: string;
    description: string;
    input_schema: JSONSchema | { type: "object"; properties: Record<string, never> };
  }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters ?? { type: "object" as const, properties: {} },
    }));
  }
}
