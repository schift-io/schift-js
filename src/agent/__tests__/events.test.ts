import { describe, expect, it, vi } from "vitest";
import { AgentEventEmitter } from "../events.js";

describe("AgentEventEmitter", () => {
  it("emits typed events", () => {
    const emitter = new AgentEventEmitter();
    const handler = vi.fn();

    emitter.on("agent_start", handler);
    emitter.emit({
      type: "agent_start",
      runId: "r1",
      timestamp: Date.now(),
      input: "hello",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].runId).toBe("r1");
  });

  it("supports wildcard handlers", () => {
    const emitter = new AgentEventEmitter();
    const wildcard = vi.fn();

    emitter.on("*", wildcard);
    emitter.emit({
      type: "turn_start",
      runId: "r1",
      timestamp: Date.now(),
      turnIndex: 0,
    });

    expect(wildcard).toHaveBeenCalledTimes(1);
    expect(wildcard.mock.calls[0][0].type).toBe("turn_start");
  });

  it("unsubscribe returned by on works", () => {
    const emitter = new AgentEventEmitter();
    const handler = vi.fn();
    const unsubscribe = emitter.on("error", handler);

    unsubscribe();
    emitter.emit({
      type: "error",
      runId: "r1",
      timestamp: Date.now(),
      error: new Error("x"),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("emits policy_violation event", () => {
    const emitter = new AgentEventEmitter();
    const handler = vi.fn();

    emitter.on("policy_violation", handler);
    emitter.emit({
      type: "policy_violation",
      runId: "r1",
      timestamp: Date.now(),
      skillName: "customer-support",
      stage: "before_tool",
      reason: "blocked tool",
      toolName: "delete_user",
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("isolates handler errors", () => {
    const emitter = new AgentEventEmitter();
    const ok = vi.fn();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    emitter.on("agent_end", () => {
      throw new Error("boom");
    });
    emitter.on("agent_end", ok);

    emitter.emit({
      type: "agent_end",
      runId: "r1",
      timestamp: Date.now(),
      output: "done",
      totalDurationMs: 1,
    });

    expect(ok).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
