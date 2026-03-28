import type { ChatMessage, MemoryConfig } from "./types.js";

/**
 * Sliding-window conversation memory.
 * Keeps the most recent N messages, always preserving the system message.
 */
export class ConversationMemory {
  private messages: ChatMessage[] = [];
  private readonly maxMessages: number;

  constructor(config?: MemoryConfig) {
    this.maxMessages = config?.maxMessages ?? 50;
  }

  /** Add a message to history. */
  add(message: ChatMessage): void {
    this.messages.push(message);
    this.trim();
  }

  /** Get all messages (system + recent history within window). */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** Clear all non-system messages. */
  clear(): void {
    this.messages = this.messages.filter((m) => m.role === "system");
  }

  /** Number of messages (including system). */
  get length(): number {
    return this.messages.length;
  }

  private trim(): void {
    if (this.messages.length <= this.maxMessages) return;
    // Keep system messages + most recent messages up to limit
    const system = this.messages.filter((m) => m.role === "system");
    const nonSystem = this.messages.filter((m) => m.role !== "system");
    const keep = nonSystem.slice(-(this.maxMessages - system.length));
    this.messages = [...system, ...keep];
  }
}
