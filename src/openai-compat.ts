/**
 * OpenAI SDK drop-in helper.
 *
 * Schift exposes an OpenAI Vector Stores + Files compatible surface at
 * `/v1/openai/*`. `openaiClient()` returns a stock `OpenAI` instance pointed
 * at that surface so existing OpenAI SDK code can target Schift by changing
 * one import — no new client to learn.
 *
 * @example
 * ```ts
 * import { openaiClient } from "@schift-io/sdk";
 *
 * const client = openaiClient(); // picks up SCHIFT_API_KEY from env
 * const vs = await client.vectorStores.create({
 *   name: "kb",
 *   metadata: { team: "support" },
 * });
 * const file = await client.files.create({
 *   file: await toFile(buffer, "policy.pdf"),
 *   purpose: "assistants",
 * });
 * await client.vectorStores.files.create(vs.id, { file_id: file.id });
 * const results = await client.vectorStores.search(vs.id, {
 *   query: "refund policy",
 *   filters: { type: "eq", key: "category", value: "refund" },
 * });
 * ```
 *
 * The `openai` package is a peer dependency:
 *   npm install openai
 */

const DEFAULT_BASE_URL = "https://api.schift.io/v1/openai";

export interface OpenAIClientOptions {
  /** Schift API key. Falls back to `SCHIFT_API_KEY` then `OPENAI_API_KEY`. */
  apiKey?: string;
  /**
   * Override the default `https://api.schift.io/v1/openai`. Useful for
   * staging or self-hosted Enterprise deployments.
   */
  baseURL?: string;
  /**
   * Any other option accepted by the `OpenAI` constructor (timeout,
   * maxRetries, fetch, defaultHeaders, etc.).
   */
  [key: string]: unknown;
}

/**
 * Return an OpenAI client pointed at Schift's OpenAI-compat surface.
 *
 * Throws if the `openai` peer dependency is not installed, or if no API key
 * can be resolved from arguments or environment.
 */
export function openaiClient(opts: OpenAIClientOptions = {}): unknown {
  let OpenAICtor: new (init: unknown) => unknown;
  try {
    // Dynamic import to keep `openai` as an optional peer dep.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("openai") as { default?: unknown; OpenAI?: unknown };
    OpenAICtor = (mod.default ?? mod.OpenAI) as new (init: unknown) => unknown;
  } catch (err) {
    throw new Error(
      "@schift-io/sdk openaiClient() requires the openai package. " +
        "Install with: npm install openai",
    );
  }

  const env =
    typeof process !== "undefined" ? process.env ?? {} : ({} as Record<string, string | undefined>);
  const { apiKey, baseURL, ...rest } = opts;
  const resolvedKey = apiKey ?? env.SCHIFT_API_KEY ?? env.OPENAI_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      "API key required. Pass { apiKey } or set SCHIFT_API_KEY / OPENAI_API_KEY.",
    );
  }

  return new OpenAICtor({
    apiKey: resolvedKey,
    baseURL: (baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    ...rest,
  });
}
