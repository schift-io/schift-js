import { describe, it, expect } from "vitest";
import { ConversationMemory } from "../memory.js";

describe("ConversationMemory", () => {
  it("stores and retrieves messages", () => {
    const memory = new ConversationMemory();
    memory.add({ role: "user", content: "Hello" });
    memory.add({ role: "assistant", content: "Hi there" });

    const messages = memory.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there" });
    expect(memory.length).toBe(2);
  });

  it("preserves system message during trim", () => {
    const memory = new ConversationMemory({ maxMessages: 4 });
    memory.add({ role: "system", content: "You are a helpful assistant." });

    // Add 5 non-system messages — total would exceed maxMessages=4
    for (let i = 1; i <= 5; i++) {
      memory.add({ role: "user", content: `Message ${i}` });
    }

    const messages = memory.getMessages();
    // system is always kept; non-system kept = 4 - 1 = 3 most recent
    expect(messages[0]).toEqual({ role: "system", content: "You are a helpful assistant." });
    const nonSystem = messages.filter((m) => m.role !== "system");
    expect(nonSystem).toHaveLength(3);
    expect(nonSystem[0].content).toBe("Message 3");
    expect(nonSystem[2].content).toBe("Message 5");
  });

  it("works with no max limit (100 messages without trimming)", () => {
    // Default maxMessages is 50; use a high explicit limit to avoid trim
    const memory = new ConversationMemory({ maxMessages: 200 });
    for (let i = 0; i < 100; i++) {
      memory.add({ role: "user", content: `msg ${i}` });
    }

    expect(memory.length).toBe(100);
    const messages = memory.getMessages();
    expect(messages[0].content).toBe("msg 0");
    expect(messages[99].content).toBe("msg 99");
  });

  it("handles tool messages with toolCallId and toolName", () => {
    const memory = new ConversationMemory();
    memory.add({ role: "assistant", content: "", toolCallId: "call_abc", toolName: "search" });
    memory.add({
      role: "tool",
      content: '{"results": ["doc1"]}',
      toolCallId: "call_abc",
      toolName: "search",
    });

    const messages = memory.getMessages();
    expect(messages).toHaveLength(2);

    const toolMsg = messages[1];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.toolCallId).toBe("call_abc");
    expect(toolMsg.toolName).toBe("search");
    expect(toolMsg.content).toBe('{"results": ["doc1"]}');
  });

  it("clears all non-system messages", () => {
    const memory = new ConversationMemory();
    memory.add({ role: "system", content: "System prompt." });
    memory.add({ role: "user", content: "Hello" });
    memory.add({ role: "assistant", content: "Hi" });

    memory.clear();

    const messages = memory.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe("System prompt.");
    expect(memory.length).toBe(1);
  });
});
