import type { SkillContract, ToolResult } from "./types.js";

export interface PolicyDecision {
  allowed: boolean;
  stage: "before_tool" | "after_tool" | "procedure" | "constraint";
  reason?: string;
}

export function policyViolation(reason: string): ToolResult {
  return {
    success: false,
    data: null,
    error: `POLICY_VIOLATION:${reason}`,
  };
}

export class PolicyEngine {
  constructor(private readonly contract: SkillContract) {}

  beforeTool(input: { toolName: string; args: Record<string, unknown> }): PolicyDecision {
    const { toolName } = input;

    if (this.contract.blockedTools?.includes(toolName)) {
      return {
        allowed: false,
        stage: "before_tool",
        reason: `tool ${toolName} is blocked`,
      };
    }

    if (this.contract.allowedTools && !this.contract.allowedTools.includes(toolName)) {
      return {
        allowed: false,
        stage: "before_tool",
        reason: `tool ${toolName} is not allowed`,
      };
    }

    return { allowed: true, stage: "before_tool" };
  }

  afterTool(_input: { toolName: string; result: ToolResult }): PolicyDecision {
    return { allowed: true, stage: "after_tool" };
  }
}
