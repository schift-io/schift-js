import { describe, it, expect, vi } from "vitest";
import { Agent } from "../agent.js";
import { RAG } from "../rag.js";
import { SkillLoader } from "../skills.js";
import type { AgentTool } from "../types.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Mock transport
const mockTransport = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

describe("Agent", () => {
  it("creates an agent with minimal config", () => {
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      transport: mockTransport as any,
    });
    expect(agent.name).toBe("test");
  });

  it("creates an agent with tools", () => {
    const tool: AgentTool = {
      name: "search",
      description: "Search things",
      handler: async () => ({ success: true, data: "found" }),
    };
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      tools: [tool],
      transport: mockTransport as any,
    });
    expect(agent.toolCount).toBe(1);
  });

  it("creates an agent with RAG (auto-registers tool)", () => {
    const rag = new RAG({ bucket: "docs" }, mockTransport as any);
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      rag,
      transport: mockTransport as any,
    });
    expect(agent.toolCount).toBe(1); // rag_search auto-registered
  });

  it("creates an agent with baseUrl (no transport needed)", () => {
    const agent = new Agent({
      name: "local",
      instructions: "Be helpful.",
      model: "llama3",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(agent.name).toBe("local");
  });

  it("throws without transport or baseUrl", () => {
    expect(() => new Agent({
      name: "broken",
      instructions: "Be helpful.",
    })).toThrow("requires either transport");
  });

  it("run delegates to runtime", async () => {
    // Mock LLM response
    mockTransport.post.mockImplementation(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{
            message: { content: "I am helpful.", tool_calls: undefined },
          }],
        };
      }
      return {};
    });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      model: "gpt-4o-mini",
      transport: mockTransport as any,
    });
    const result = await agent.run("Hello");
    expect(result.output).toBe("I am helpful.");
  });

  it("supports run options with AbortSignal", async () => {
    const agent = new Agent({
      name: "test",
      instructions: "Be helpful.",
      model: "gpt-4o-mini",
      transport: mockTransport as any,
    });

    const ac = new AbortController();
    ac.abort();
    const result = await agent.run("Hello", { signal: ac.signal, requestId: "r1" });

    expect(result.output).toContain("aborted");
  });

  it("loads skills and emits events", async () => {
    mockTransport.post.mockImplementation(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{
            message: { content: "answer from skill-enabled run", tool_calls: undefined },
          }],
        };
      }
      return {};
    });

    const dir = mkdtempSync(resolve(tmpdir(), "agent-skills-"));
    try {
      writeFileSync(
        resolve(dir, "support.md"),
        `---\nname: support-skill\ndescription: Handle support\n---\n\nAlways help users.`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();

      const agent = new Agent({
        name: "test",
        instructions: "Be helpful.",
        transport: mockTransport as any,
        skills: { loader },
      });

      const onEnd = vi.fn();
      agent.on("agent_end", onEnd);
      const result = await agent.run("Hello");

      expect(result.output).toContain("skill-enabled");
      expect(onEnd).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses primary skill model over agent default model", async () => {
    const postSpy = vi.fn(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{ message: { content: "ok", tool_calls: undefined } }],
        };
      }
      return {};
    });

    const dir = mkdtempSync(resolve(tmpdir(), "agent-skills-model-"));
    try {
      writeFileSync(
        resolve(dir, "support.md"),
        `---\nname: customer-support\ndescription: reset password support\nmodel: claude-sonnet-4-6\n---\n\nAlways help users.`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();

      const agent = new Agent({
        name: "test",
        instructions: "Be helpful.",
        model: "gpt-4o-mini",
        transport: {
          ...mockTransport,
          post: postSpy,
        } as any,
        skills: { loader },
      });

      await agent.run("reset password");

      expect(postSpy).toHaveBeenCalled();
      expect(postSpy.mock.calls[0][1].model).toBe("claude-sonnet-4-6");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips skill auto-resolution when skills.autoResolve is false", async () => {
    const postSpy = vi.fn(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{ message: { content: "ok", tool_calls: undefined } }],
        };
      }
      return {};
    });

    const dir = mkdtempSync(resolve(tmpdir(), "agent-skills-no-autoresolve-"));
    try {
      writeFileSync(
        resolve(dir, "support.md"),
        `---\nname: customer-support\ndescription: reset password support\nmodel: claude-sonnet-4-6\n---\n\nAlways help users.`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();

      const agent = new Agent({
        name: "test",
        instructions: "Be helpful.",
        model: "gpt-4o-mini",
        transport: {
          ...mockTransport,
          post: postSpy,
        } as any,
        skills: { loader, autoResolve: false },
      });

      const resolvePrimarySpy = vi.spyOn((agent as any).skillResolver, "resolvePrimary");
      await agent.run("reset password");

      expect(resolvePrimarySpy).not.toHaveBeenCalled();
      expect(postSpy).toHaveBeenCalled();
      expect(postSpy.mock.calls[0][1].model).toBe("gpt-4o-mini");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes blocked tools from runtime tool registry", async () => {
    const postSpy = vi.fn(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{ message: { content: "ok", tool_calls: undefined } }],
        };
      }
      return {};
    });

    const dir = mkdtempSync(resolve(tmpdir(), "agent-skills-blocked-tools-"));
    try {
      writeFileSync(
        resolve(dir, "support.md"),
        `---\nname: customer-support\ndescription: reset password support\nblocked-tools: delete_user\n---\n\nAlways help users.`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();

      const searchTool: AgentTool = {
        name: "search_docs",
        description: "Search docs",
        handler: async () => ({ success: true, data: [] }),
      };
      const deleteTool: AgentTool = {
        name: "delete_user",
        description: "Delete user",
        handler: async () => ({ success: true, data: true }),
      };

      const agent = new Agent({
        name: "test",
        instructions: "Be helpful.",
        transport: {
          ...mockTransport,
          post: postSpy,
        } as any,
        tools: [searchTool, deleteTool],
        skills: { loader },
      });

      await agent.run("reset password");

      const toolNames = (postSpy.mock.calls[0][1].tools as Array<{ function: { name: string } }>).map(
        (t) => t.function.name,
      );
      expect(toolNames).toContain("search_docs");
      expect(toolNames).not.toContain("delete_user");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prioritizes blocked-tools over allowed-tools", async () => {
    const postSpy = vi.fn(async (path: string) => {
      if (path === "/v1/chat/completions") {
        return {
          choices: [{ message: { content: "ok", tool_calls: undefined } }],
        };
      }
      return {};
    });

    const dir = mkdtempSync(resolve(tmpdir(), "agent-skills-allow-block-"));
    try {
      writeFileSync(
        resolve(dir, "support.md"),
        `---\nname: customer-support\ndescription: reset password support\nallowed-tools: search_docs delete_user\nblocked-tools: delete_user\n---\n\nAlways help users.`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();

      const searchTool: AgentTool = {
        name: "search_docs",
        description: "Search docs",
        handler: async () => ({ success: true, data: [] }),
      };
      const deleteTool: AgentTool = {
        name: "delete_user",
        description: "Delete user",
        handler: async () => ({ success: true, data: true }),
      };

      const agent = new Agent({
        name: "test",
        instructions: "Be helpful.",
        transport: {
          ...mockTransport,
          post: postSpy,
        } as any,
        tools: [searchTool, deleteTool],
        skills: { loader },
      });

      await agent.run("reset password");

      const toolNames = (postSpy.mock.calls[0][1].tools as Array<{ function: { name: string } }>).map(
        (t) => t.function.name,
      );
      expect(toolNames).toContain("search_docs");
      expect(toolNames).not.toContain("delete_user");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
