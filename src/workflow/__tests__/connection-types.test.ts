import { describe, it, expect } from "vitest";
import {
  ConnectionTypes,
  ConnectionFamilies,
  allConnectionTypes,
  familyOf,
  isCompatible,
} from "../connection-types.js";

describe("ConnectionTypes", () => {
  it("includes Main + AI sidecar + RAG-native + HITL ports", () => {
    expect(ConnectionTypes.Main).toBe("main");
    expect(ConnectionTypes.AgentLanguageModel).toBe("agent_languageModel");
    expect(ConnectionTypes.RagCollection).toBe("rag_collection");
    expect(ConnectionTypes.RagDecisionReview).toBe("rag_decisionReview");
    expect(ConnectionTypes.HumanApproval).toBe("human_approval");
  });

  it("allConnectionTypes lists every port", () => {
    expect(allConnectionTypes.length).toBeGreaterThan(10);
    expect(allConnectionTypes).toContain("main");
    expect(allConnectionTypes).toContain("rag_bucket");
  });

  it("families partition the port set", () => {
    const flat = Object.values(ConnectionFamilies).flat();
    const unique = new Set(flat);
    // Every port belongs to exactly one family
    expect(unique.size).toBe(flat.length);
    expect(unique.size).toBe(allConnectionTypes.length);
  });

  it("familyOf classifies correctly", () => {
    expect(familyOf("main")).toBe("data");
    expect(familyOf("agent_languageModel")).toBe("agent");
    expect(familyOf("rag_collection")).toBe("rag");
    expect(familyOf("human_approval")).toBe("hitl");
  });

  it("isCompatible is exact-match (no implicit conversion)", () => {
    expect(isCompatible("main", "main")).toBe(true);
    expect(isCompatible("rag_collection", "rag_collection")).toBe(true);
    expect(isCompatible("main", "rag_collection")).toBe(false);
    expect(isCompatible("agent_tool", "agent_languageModel")).toBe(false);
  });
});
