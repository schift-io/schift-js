import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ExtensionHost, type ExtensionAPI } from "../extensions.js";

describe("ExtensionHost", () => {
  it("loads inline extension and registers tool", async () => {
    const registerTool = vi.fn();
    const on = vi.fn(() => () => {});
    const off = vi.fn();

    const api: ExtensionAPI = {
      registerTool,
      on,
      off,
      agentName: "test-agent",
    };

    const host = new ExtensionHost(api);
    await host.load(async (ctx) => {
      ctx.registerTool({
        name: "hello",
        description: "hello",
        handler: async () => ({ success: true, data: "ok" }),
      });
    });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0][0].name).toBe("hello");
  });

  it("loads extension from module path", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "ext-"));
    try {
      const file = resolve(dir, "ext.mjs");
      writeFileSync(
        file,
        `export default async function(api){ api.registerTool({ name: "from_file", description: "x", handler: async ()=>({ success:true, data:"ok" }) }); }`,
        "utf-8",
      );

      const registerTool = vi.fn();
      const api: ExtensionAPI = {
        registerTool,
        on: vi.fn(() => () => {}),
        off: vi.fn(),
        agentName: "test-agent",
      };

      const host = new ExtensionHost(api);
      await host.load(file);

      expect(registerTool).toHaveBeenCalledTimes(1);
      expect(registerTool.mock.calls[0][0].name).toBe("from_file");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
