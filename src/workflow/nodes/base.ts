import type { BlockDef } from "../yaml.js";

// ---- Execution Context ----

export interface SDKExecutionContext {
  client?: unknown;
  runId: string;
  variables: Record<string, unknown>;
  getVar(key: string, defaultValue?: unknown): unknown;
  setVar(key: string, value: unknown): void;
}

// ---- Base Node ----

export abstract class SDKBaseNode {
  readonly block: BlockDef;
  readonly config: Record<string, unknown>;

  constructor(block: BlockDef) {
    this.block = block;
    this.config = block.config ?? {};
  }

  abstract execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>>;

  validateConfig(): string[] {
    return [];
  }
}

// ---- Helpers ----

export async function maybeAwait<T>(result: T | Promise<T>): Promise<T> {
  if (result && typeof (result as Promise<T>).then === "function") {
    return result as Promise<T>;
  }
  return result as T;
}

export function getEnvApiKey(provider: string): string {
  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
  };
  const envVar = envMap[provider] ?? `${provider.toUpperCase()}_API_KEY`;
  const key = process.env[envVar] ?? "";
  if (!key) {
    throw new Error(
      `No API key for provider '${provider}'. Set the ${envVar} environment variable.`,
    );
  }
  return key;
}
