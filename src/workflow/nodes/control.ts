import { SDKBaseNode } from "./base.js";

export class StartNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return inputs;
  }
}

export class EndNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return { result: inputs };
  }
}

export class PassthroughNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return inputs;
  }
}
