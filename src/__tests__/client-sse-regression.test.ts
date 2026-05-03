import { describe, expect, it, vi } from "vitest";
import { Schift } from "../client.js";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(chunks[i]!));
      i++;
    },
  });
}

describe("Schift chatStream SSE parser", () => {
  it("preserves event type when event and data arrive in different reads", async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url).replace("https://api.schift.io", "");
      if (path === "/v1/buckets") {
        return new Response(JSON.stringify([{ id: "bucket_1", name: "docs" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        sseStream([
          "event: pipeline_step\n",
          'data: {"step":"search","status":"completed"}\n\n',
          "data: [DONE]\n\n",
        ]),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    });
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      const client = new Schift({ apiKey: "sch_test" });
      const events = [];
      for await (const event of client.chatStream({ bucketId: "docs", message: "hi" })) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: "pipeline_step", step: "search", status: "completed" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
