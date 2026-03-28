import { SDKBaseNode } from "./base.js";

export class ServerOnlyNode extends SDKBaseNode {
  async execute(): Promise<Record<string, unknown>> {
    throw new Error(
      `Block type '${this.block.type}' is server-only and cannot be ` +
        `executed in the local SDK engine. Use the Schift API to run ` +
        `workflows containing this block type.`,
    );
  }
}
