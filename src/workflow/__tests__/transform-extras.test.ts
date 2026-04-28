import { describe, it, expect } from "vitest";
import {
  SetNode,
  FilterNode,
  SwitchNode,
  AggregateNode,
  SortNode,
  LimitNode,
  SplitOutNode,
  SummarizeNode,
  RemoveDuplicatesNode,
  DateTimeNode,
} from "../nodes/transform-extras.js";
import type { BlockDef } from "../yaml.js";
import type { SDKExecutionContext } from "../nodes/base.js";

const ctx: SDKExecutionContext = {
  runId: "test",
  variables: {},
  getVar: () => undefined,
  setVar: () => {},
};

function block(type: string, config: Record<string, unknown>): BlockDef {
  return { id: "b1", type, title: type, position: { x: 0, y: 0 }, config };
}

describe("SetNode", () => {
  it("manual mode sets fields per item", async () => {
    const node = new SetNode(
      block("set", {
        mode: "manual",
        fields: {
          values: [
            { name: "status", type: "string", value: "active" },
            { name: "count", type: "number", value: "42" },
          ],
        },
      }),
    );
    const out = await node.execute({ items: [{ id: 1 }, { id: 2 }] }, ctx);
    expect(out.items).toEqual([
      { id: 1, status: "active", count: 42 },
      { id: 2, status: "active", count: 42 },
    ]);
  });

  it("json mode merges parsed object into each item", async () => {
    const node = new SetNode(block("set", { mode: "json", json: '{"flag":true}' }));
    const out = await node.execute({ items: [{ id: 1 }] }, ctx);
    expect(out.items).toEqual([{ id: 1, flag: true }]);
  });
});

describe("FilterNode", () => {
  it("keeps items matching equals condition", async () => {
    const node = new FilterNode(
      block("filter", {
        conditions: {
          combinator: "and",
          conditions: [
            {
              leftValue: "={{$json.status}}",
              rightValue: "active",
              operator: { type: "string", operation: "equals" },
            },
          ],
        },
      }),
    );
    const out = await node.execute(
      { items: [{ status: "active" }, { status: "inactive" }, { status: "active" }] },
      ctx,
    );
    expect(out.items).toEqual([{ status: "active" }, { status: "active" }]);
  });

  it("supports OR combinator", async () => {
    const node = new FilterNode(
      block("filter", {
        conditions: {
          combinator: "or",
          conditions: [
            { leftValue: "={{$json.n}}", rightValue: 1, operator: { type: "number", operation: "equals" } },
            { leftValue: "={{$json.n}}", rightValue: 3, operator: { type: "number", operation: "equals" } },
          ],
        },
      }),
    );
    const out = await node.execute({ items: [{ n: 1 }, { n: 2 }, { n: 3 }] }, ctx);
    expect((out.items as Record<string, number>[]).map((i) => i.n)).toEqual([1, 3]);
  });
});

describe("SwitchNode (rules mode)", () => {
  it("routes by rule + collects unmatched into default", async () => {
    const node = new SwitchNode(
      block("switch", {
        mode: "rules",
        rules: [
          {
            output: "high",
            condition: {
              combinator: "and",
              conditions: [{ leftValue: "={{$json.n}}", rightValue: 10, operator: { operation: "gt" } }],
            },
          },
        ],
      }),
    );
    const out = await node.execute({ items: [{ n: 5 }, { n: 20 }, { n: 30 }] }, ctx);
    expect(out.high).toEqual([{ n: 20 }, { n: 30 }]);
    expect(out.default).toEqual([{ n: 5 }]);
  });
});

describe("AggregateNode", () => {
  it("aggregateAllItemData wraps items into a single record", async () => {
    const node = new AggregateNode(block("aggregate", { aggregate: "aggregateAllItemData" }));
    const out = await node.execute({ items: [{ id: 1 }, { id: 2 }] }, ctx);
    expect(out.items).toEqual([{ data: [{ id: 1 }, { id: 2 }] }]);
  });

  it("individualFields collects field values into a list", async () => {
    const node = new AggregateNode(block("aggregate", { aggregate: "individualFields", field: "id" }));
    const out = await node.execute({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] }, ctx);
    expect(out.items).toEqual([{ id: [1, 2, 3] }]);
  });
});

describe("SortNode", () => {
  it("sorts ascending by default", async () => {
    const node = new SortNode(block("sort", { sortBy: "n", order: "ascending" }));
    const out = await node.execute({ items: [{ n: 3 }, { n: 1 }, { n: 2 }] }, ctx);
    expect((out.items as { n: number }[]).map((i) => i.n)).toEqual([1, 2, 3]);
  });

  it("sorts descending", async () => {
    const node = new SortNode(block("sort", { sortBy: "n", order: "descending" }));
    const out = await node.execute({ items: [{ n: 1 }, { n: 3 }, { n: 2 }] }, ctx);
    expect((out.items as { n: number }[]).map((i) => i.n)).toEqual([3, 2, 1]);
  });
});

describe("LimitNode", () => {
  it("keeps first N", async () => {
    const node = new LimitNode(block("limit", { maxItems: 2, keep: "firstItems" }));
    const out = await node.execute({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] }, ctx);
    expect((out.items as { id: number }[]).map((i) => i.id)).toEqual([1, 2]);
  });

  it("keeps last N", async () => {
    const node = new LimitNode(block("limit", { maxItems: 2, keep: "lastItems" }));
    const out = await node.execute({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] }, ctx);
    expect((out.items as { id: number }[]).map((i) => i.id)).toEqual([2, 3]);
  });
});

describe("SplitOutNode", () => {
  it("explodes a list field into one item per element", async () => {
    const node = new SplitOutNode(block("split_out", { fieldToSplitOut: "tags" }));
    const out = await node.execute(
      { items: [{ id: 1, tags: ["a", "b", "c"] }, { id: 2, tags: ["x"] }] },
      ctx,
    );
    expect(out.items).toEqual([
      { id: 1, tags: "a" },
      { id: 1, tags: "b" },
      { id: 1, tags: "c" },
      { id: 2, tags: "x" },
    ]);
  });
});

describe("SummarizeNode", () => {
  it("groups by field + counts", async () => {
    const node = new SummarizeNode(
      block("summarize", {
        groupBy: "team",
        aggregations: { values: [{ fn: "count", field: "" }] },
      }),
    );
    const out = await node.execute(
      { items: [{ team: "a" }, { team: "a" }, { team: "b" }] },
      ctx,
    );
    expect(out.items).toEqual([
      { team: "a", count_items: 2 },
      { team: "b", count_items: 1 },
    ]);
  });

  it("computes sum + avg", async () => {
    const node = new SummarizeNode(
      block("summarize", {
        groupBy: "team",
        aggregations: {
          values: [
            { fn: "sum", field: "score" },
            { fn: "avg", field: "score" },
          ],
        },
      }),
    );
    const out = await node.execute(
      { items: [{ team: "a", score: 10 }, { team: "a", score: 20 }] },
      ctx,
    );
    const row = (out.items as Record<string, unknown>[])[0];
    expect(row.sum_score).toBe(30);
    expect(row.avg_score).toBe(15);
  });
});

describe("RemoveDuplicatesNode", () => {
  it("dedupes by all fields", async () => {
    const node = new RemoveDuplicatesNode(block("remove_duplicates", { compare: "allFields" }));
    const out = await node.execute(
      { items: [{ id: 1 }, { id: 2 }, { id: 1 }] },
      ctx,
    );
    expect(out.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("dedupes by selected fields", async () => {
    const node = new RemoveDuplicatesNode(
      block("remove_duplicates", { compare: "selectedFields", fields: "email" }),
    );
    const out = await node.execute(
      {
        items: [
          { id: 1, email: "a@x" },
          { id: 2, email: "a@x" },
          { id: 3, email: "b@x" },
        ],
      },
      ctx,
    );
    expect((out.items as { id: number }[]).length).toBe(2);
  });
});

describe("DateTimeNode", () => {
  it("formats current date when op=now", async () => {
    const node = new DateTimeNode(block("datetime", { operation: "now", format: "yyyy-MM-dd" }));
    const out = await node.execute({}, ctx);
    expect(typeof out.datetime).toBe("string");
    expect(out.datetime as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes diff in seconds", async () => {
    const node = new DateTimeNode(
      block("datetime", {
        operation: "diff",
        value: "2026-01-01T00:00:00Z",
        endValue: "2026-01-01T00:01:00Z",
      }),
    );
    const out = await node.execute({}, ctx);
    expect(out.datetime).toBe(60);
  });
});
