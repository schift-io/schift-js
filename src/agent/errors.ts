import { SchiftError } from "../errors.js";

export class AgentError extends SchiftError {
  public readonly stepId?: string;
  constructor(message: string, stepId?: string) {
    super(message, undefined, "agent_error");
    this.name = "AgentError";
    this.stepId = stepId;
  }
}

export class ToolError extends AgentError {
  public readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(`Tool '${toolName}' failed: ${message}`);
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class MaxStepsError extends AgentError {
  constructor(maxSteps: number) {
    super(`Agent exceeded maximum steps (${maxSteps})`);
    this.name = "MaxStepsError";
  }
}
