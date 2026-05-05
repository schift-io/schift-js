import { afterEach, describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";
import { EntitlementError } from "../errors.js";

/**
 * ProvidersClient is exposed as `client.providers`. It uses the parent client's
 * HttpTransport (auth headers, base URL, error mapping). Mock `globalThis.fetch`
 * with real Response objects so the response-handling code paths actually run.
 */
describe("ProvidersClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("get() issues GET /v1/providers/{provider} and parses ProviderConfig", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "openai",
          configured: true,
          endpoint_url: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const config = await client.providers.get("openai");

    expect(config).toEqual({
      provider: "openai",
      configured: true,
      endpoint_url: null,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/providers/openai");
    expect(init?.method).toBe("GET");
    expect(
      (init?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer sch_test");
  });

  it("set() issues PUT /v1/providers/{provider} with the api_key body", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "google",
          configured: true,
          endpoint_url: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    const config = await client.providers.set("google", {
      api_key: "AIzaTEST",
    });

    expect(config.configured).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.schift.io/v1/providers/google");
    expect(init?.method).toBe("PUT");
    expect(
      (init?.headers as Record<string, string>)["Content-Type"],
    ).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ api_key: "AIzaTEST" });
  });

  it("set() forwards endpoint_url for self-hosted endpoints", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: "openai",
          configured: true,
          endpoint_url: "https://my-llm.example.com/v1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await client.providers.set("openai", {
      api_key: "sk-x",
      endpoint_url: "https://my-llm.example.com/v1",
    });

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      api_key: "sk-x",
      endpoint_url: "https://my-llm.example.com/v1",
    });
  });

  it("maps 403 to EntitlementError on get()", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "BYOK requires Pro plan" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch as typeof fetch;

    const client = new Schift({ apiKey: "sch_test" });
    await expect(client.providers.get("openai")).rejects.toBeInstanceOf(
      EntitlementError,
    );
    await expect(client.providers.get("openai")).rejects.toThrow(
      /BYOK requires Pro plan/,
    );
  });
});
