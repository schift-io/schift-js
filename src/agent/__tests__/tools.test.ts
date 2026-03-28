import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../tools.js";
import type { AgentTool } from "../types.js";

const echoTool: AgentTool = {
  name: "echo",
  description: "Echoes input back",
  parameters: {
    type: "object",
    properties: { message: { type: "string", description: "Message to echo" } },
    required: ["message"],
  },
  handler: async (args) => ({ success: true, data: args.message }),
};

const failTool: AgentTool = {
  name: "fail",
  description: "Always fails",
  handler: async () => { throw new Error("boom"); },
};

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(reg.get("echo")).toBe(echoTool);
  });

  it("lists all tools", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(reg.list()).toHaveLength(1);
    expect(reg.list()[0].name).toBe("echo");
  });

  it("throws on duplicate name", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(() => reg.register(echoTool)).toThrow("already registered");
  });

  it("throws on invalid tool name", () => {
    const bad = { ...echoTool, name: "has spaces" };
    const reg = new ToolRegistry();
    expect(() => reg.register(bad)).toThrow("invalid tool name");
  });

  it("executes a tool", async () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const result = await reg.execute("echo", { message: "hello" });
    expect(result).toEqual({ success: true, data: "hello" });
  });

  it("wraps handler errors in ToolResult", async () => {
    const reg = new ToolRegistry();
    reg.register(failTool);
    const result = await reg.execute("fail", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("boom");
  });

  it("throws on execute unknown tool", async () => {
    const reg = new ToolRegistry();
    await expect(reg.execute("nope", {})).rejects.toThrow("not found");
  });

  it("generates OpenAI-format tool definitions", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const defs = reg.toOpenAI();
    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe("function");
    expect(defs[0].function.name).toBe("echo");
    expect(defs[0].function.parameters).toEqual(echoTool.parameters);
  });

  it("generates Anthropic-format tool definitions", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const defs = reg.toAnthropic();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("echo");
    expect(defs[0].input_schema).toEqual(echoTool.parameters);
  });
});
