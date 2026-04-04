import { describe, expect, it } from "vitest";
import { PolicyEngine, policyViolation } from "../policy.js";

describe("PolicyEngine", () => {
  it("blocks tool in blockedTools", () => {
    const engine = new PolicyEngine({
      skillName: "customer-support",
      blockedTools: ["delete_user"],
    });

    const decision = engine.beforeTool({ toolName: "delete_user", args: {} });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("blocked");
    expect(decision.stage).toBe("before_tool");
  });

  it("blocks tool outside allowedTools", () => {
    const engine = new PolicyEngine({
      skillName: "customer-support",
      allowedTools: ["search_docs"],
    });

    const decision = engine.beforeTool({ toolName: "delete_user", args: {} });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("not allowed");
  });

  it("returns policy violation tool result helper", () => {
    const result = policyViolation("tool delete_user is blocked");
    expect(result).toEqual({
      success: false,
      data: null,
      error: "POLICY_VIOLATION:tool delete_user is blocked",
    });
  });
});
