import type { HttpTransport } from "../workflow/client.js";

export type ProviderName = "openai" | "google" | "anthropic";

export interface ProviderConfig {
  provider: ProviderName;
  configured: boolean;
  endpoint_url: string | null;
}

export interface SetProviderKeyRequest {
  api_key: string;
  endpoint_url?: string;
}

const BASE = "/v1/providers";

/**
 * Client for managing LLM provider API keys (BYOK).
 *
 * @example
 * ```ts
 * const schift = new Schift({ apiKey: "sch_xxx" });
 *
 * // Register a Gemini key
 * await schift.providers.set("google", { api_key: "AIza..." });
 *
 * // Check if OpenAI is configured
 * const config = await schift.providers.get("openai");
 * console.log(config.configured); // true/false
 * ```
 */
export class ProvidersClient {
  private readonly http: HttpTransport;

  constructor(http: HttpTransport) {
    this.http = http;
  }

  /**
   * Get the configuration status of a provider.
   * The API key itself is never returned for security.
   */
  async get(provider: ProviderName): Promise<ProviderConfig> {
    return this.http.get<ProviderConfig>(`${BASE}/${provider}`);
  }

  /**
   * Set (or update) a provider API key.
   */
  async set(
    provider: ProviderName,
    request: SetProviderKeyRequest,
  ): Promise<ProviderConfig> {
    return this.http.put<ProviderConfig>(
      `${BASE}/${provider}`,
      request as unknown as Record<string, unknown>,
    );
  }
}
