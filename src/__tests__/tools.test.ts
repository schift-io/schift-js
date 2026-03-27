import { describe, it, expect, vi } from "vitest";
import { SchiftTools } from "../tools.js";

const mockSearch = vi.fn().mockResolvedValue([
  { id: "doc_1", score: 0.95, modality: "text", metadata: { title: "Contract" } },
  { id: "doc_2", score: 0.87, modality: "text", metadata: { title: "Invoice" } },
]);

const mockChat = vi.fn().mockResolvedValue({
  reply: "해지 조건은 3조 2항에 명시되어 있습니다.",
  sources: [{ id: "doc_1", score: 0.95, text: "3조 2항..." }],
  model: "gpt-4o-mini",
});

function createTools(opts = {}) {
  return new SchiftTools(mockSearch, mockChat, {
    collection: "contracts",
    bucketId: "my-bucket",
    includeChat: true,
    ...opts,
  });
}

describe("SchiftTools", () => {
  // ---- OpenAI format ----

  describe("openai()", () => {
    it("returns search tool definition", () => {
      const tools = createTools().openai();
      expect(tools.length).toBeGreaterThanOrEqual(1);
      const search = tools[0] as any;
      expect(search.type).toBe("function");
      expect(search.function.name).toBe("schift_search");
      expect(search.function.parameters.required).toContain("query");
    });

    it("includes chat tool when includeChat=true", () => {
      const tools = createTools({ includeChat: true }).openai();
      expect(tools.length).toBe(2);
      expect((tools[1] as any).function.name).toBe("schift_chat");
    });

    it("excludes chat tool when includeChat=false", () => {
      const tools = createTools({ includeChat: false }).openai();
      expect(tools.length).toBe(1);
    });

    it("uses custom prefix", () => {
      const tools = createTools({ prefix: "myapp" }).openai();
      expect((tools[0] as any).function.name).toBe("myapp_search");
    });
  });

  // ---- Anthropic format ----

  describe("anthropic()", () => {
    it("returns search tool with input_schema", () => {
      const tools = createTools().anthropic();
      const search = tools[0] as any;
      expect(search.name).toBe("schift_search");
      expect(search.input_schema.properties.query).toBeDefined();
    });
  });

  // ---- Vercel AI SDK format ----

  describe("vercelAI()", () => {
    it("returns tools with execute functions", () => {
      const tools = createTools().vercelAI();
      expect(tools["schift_search"]).toBeDefined();
      expect((tools["schift_search"] as any).execute).toBeInstanceOf(Function);
    });
  });

  // ---- handle() ----

  describe("handle()", () => {
    it("handles OpenAI format tool call", async () => {
      mockSearch.mockClear();
      const tools = createTools();
      const result = await tools.handle({
        function: {
          name: "schift_search",
          arguments: JSON.stringify({ query: "해지 조건" }),
        },
      });
      expect(mockSearch).toHaveBeenCalledWith({
        query: "해지 조건",
        collection: "contracts",
        topK: 5,
      });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe("doc_1");
    });

    it("handles Anthropic format tool call", async () => {
      mockSearch.mockClear();
      const tools = createTools();
      const result = await tools.handle({
        type: "tool_use",
        name: "schift_search",
        input: { query: "인보이스 총액", top_k: 3 },
      });
      expect(mockSearch).toHaveBeenCalledWith({
        query: "인보이스 총액",
        collection: "contracts",
        topK: 3,
      });
      expect(JSON.parse(result)).toHaveLength(2);
    });

    it("handles chat tool call", async () => {
      mockChat.mockClear();
      const tools = createTools();
      const result = await tools.handle({
        function: {
          name: "schift_chat",
          arguments: JSON.stringify({ message: "해지 조건이 뭐야?" }),
        },
      });
      expect(mockChat).toHaveBeenCalled();
      const parsed = JSON.parse(result);
      expect(parsed.reply).toContain("3조 2항");
    });

    it("throws on unknown tool name", async () => {
      const tools = createTools();
      await expect(
        tools.handle({ function: { name: "unknown_tool", arguments: "{}" } }),
      ).rejects.toThrow("Unknown tool");
    });

    it("throws on unrecognized format", async () => {
      const tools = createTools();
      await expect(tools.handle({} as any)).rejects.toThrow("Unrecognized");
    });

    it("uses default collection from config", async () => {
      mockSearch.mockClear();
      const tools = createTools({ collection: "legal-docs" });
      await tools.handle({
        function: {
          name: "schift_search",
          arguments: JSON.stringify({ query: "test" }),
        },
      });
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ collection: "legal-docs" }),
      );
    });
  });
});
