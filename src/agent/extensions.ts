import type { AgentTool } from "./types.js";
import type { AgentEventType, AgentEventMap } from "./events.js";
import { pathToFileURL } from "node:url";

export interface ExtensionAPI {
  registerTool(tool: AgentTool): void;
  on<K extends AgentEventType>(
    type: K,
    handler: (event: AgentEventMap[K]) => void,
  ): () => void;
  off<K extends AgentEventType>(
    type: K,
    handler: (event: AgentEventMap[K]) => void,
  ): void;
  readonly agentName: string;
}

export type ExtensionInitFn = (api: ExtensionAPI) => void | Promise<void>;

export class ExtensionHost {
  constructor(private readonly api: ExtensionAPI) {}

  async load(extension: ExtensionInitFn | string): Promise<void> {
    if (typeof extension === "function") {
      await extension(this.api);
      return;
    }

    const moduleUrl = pathToFileURL(extension).href;
    const mod = await import(moduleUrl);
    const fn = this.pickInitFn(mod);
    await fn(this.api);
  }

  private pickInitFn(mod: Record<string, unknown>): ExtensionInitFn {
    if (typeof mod.default === "function") {
      return mod.default as ExtensionInitFn;
    }
    if (typeof mod.init === "function") {
      return mod.init as ExtensionInitFn;
    }
    throw new Error("Extension module must export default(api) or init(api)");
  }
}
