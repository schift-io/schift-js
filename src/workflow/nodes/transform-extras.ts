/**
 * n8n-derived data transformation handlers.
 *
 * All handlers operate on items array convention: input has either an `items`
 * field (preferred) or treats the whole inputs object as a single item. Output
 * shape mirrors n8n: `{ items: [...] }`.
 */

import { SDKBaseNode } from "./base.js";
import type { SDKExecutionContext } from "./base.js";

type Item = Record<string, unknown>;

/** Coerce arbitrary inputs into an array of items. */
function toItems(inputs: Record<string, unknown>): Item[] {
  if (Array.isArray(inputs.items)) return inputs.items as Item[];
  if (Array.isArray(inputs.in)) return inputs.in as Item[];
  // Single-item passthrough
  return [inputs];
}

/** Resolve dotted path on an item (e.g. "user.name"). */
function pick(item: Item, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = item;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

// ===== Set / Edit Fields =====

export class SetNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const mode = (this.config.mode as string) ?? "manual";

    if (mode === "json") {
      const json = (this.config.json as string) ?? "{}";
      let parsed: Item;
      try {
        parsed = JSON.parse(json) as Item;
      } catch {
        parsed = {};
      }
      return { items: items.map((it) => ({ ...it, ...parsed })) };
    }

    type FieldSpec = { name: string; type?: string; value: unknown };
    const fieldsRaw = (this.config.fields as { values?: FieldSpec[] } | FieldSpec[]) ?? {};
    const fields: FieldSpec[] = Array.isArray(fieldsRaw)
      ? fieldsRaw
      : (fieldsRaw.values ?? []);

    const out = items.map((it) => {
      const merged: Item = { ...it };
      for (const f of fields) {
        let v: unknown = f.value;
        if (f.type === "number" && typeof v === "string") v = Number(v);
        else if (f.type === "boolean" && typeof v === "string") v = v === "true";
        else if (f.type === "object" || f.type === "array") {
          if (typeof v === "string") {
            try {
              v = JSON.parse(v);
            } catch {
              /* leave as string */
            }
          }
        }
        merged[f.name] = v;
      }
      return merged;
    });

    return { items: out };
  }
}

// ===== Filter =====

interface FilterCondition {
  leftValue: unknown;
  rightValue: unknown;
  operator: { type: string; operation: string };
}
interface FilterSpec {
  combinator?: "and" | "or";
  conditions?: FilterCondition[];
  options?: { caseSensitive?: boolean };
}

function evalCondition(c: FilterCondition, item: Item, caseSensitive: boolean): boolean {
  // leftValue is typically a path expression like "={{$json.field}}" or literal
  let lv: unknown = c.leftValue;
  if (typeof lv === "string" && lv.startsWith("={{") && lv.endsWith("}}")) {
    const path = lv.slice(3, -2).trim().replace(/^\$json\./, "");
    lv = pick(item, path);
  } else if (typeof lv === "string" && !lv.startsWith("=")) {
    // bare path
    if (lv in item) lv = item[lv];
  }
  const rv = c.rightValue;
  const op = c.operator?.operation ?? "equals";

  if (op === "exists") return lv !== undefined && lv !== null;
  if (op === "isEmpty") return lv == null || lv === "";

  let l = lv, r = rv;
  if (!caseSensitive && typeof l === "string" && typeof r === "string") {
    l = l.toLowerCase();
    r = r.toLowerCase();
  }

  switch (op) {
    case "equals": return l === r;
    case "notEquals": return l !== r;
    case "gt": return Number(l) > Number(r);
    case "gte": return Number(l) >= Number(r);
    case "lt": return Number(l) < Number(r);
    case "lte": return Number(l) <= Number(r);
    case "contains": return typeof l === "string" && l.includes(String(r));
    case "notContains": return typeof l === "string" && !l.includes(String(r));
    case "startsWith": return typeof l === "string" && l.startsWith(String(r));
    case "endsWith": return typeof l === "string" && l.endsWith(String(r));
    case "regex":
      try { return typeof l === "string" && new RegExp(String(r)).test(l); }
      catch { return false; }
    default: return l === r;
  }
}

function evalFilter(spec: FilterSpec, item: Item): boolean {
  const combinator = spec.combinator ?? "and";
  const conditions = spec.conditions ?? [];
  if (!conditions.length) return true;
  const caseSensitive = spec.options?.caseSensitive ?? true;
  if (combinator === "or") return conditions.some((c) => evalCondition(c, item, caseSensitive));
  return conditions.every((c) => evalCondition(c, item, caseSensitive));
}

export class FilterNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const conditions = (this.config.conditions as FilterSpec) ?? {};
    const kept = items.filter((it) => evalFilter(conditions, it));
    return { items: kept };
  }
}

// ===== Switch =====

export class SwitchNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const mode = (this.config.mode as string) ?? "expression";

    if (mode === "expression") {
      const output = (this.config.output as string) ?? "0";
      // For now, static routing — all items to the chosen branch
      return { [output]: items };
    }

    // Rules mode: evaluate each rule; first match wins
    interface Rule { output: string; condition: FilterSpec }
    const rules = (this.config.rules as Rule[]) ?? [];
    const branches: Record<string, Item[]> = {};
    const fallback: Item[] = [];

    for (const it of items) {
      let routed = false;
      for (const rule of rules) {
        if (evalFilter(rule.condition, it)) {
          (branches[rule.output] ??= []).push(it);
          routed = true;
          break;
        }
      }
      if (!routed) fallback.push(it);
    }
    return { ...branches, default: fallback };
  }
}

// ===== Aggregate =====

export class AggregateNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const mode = (this.config.aggregate as string) ?? "individualFields";

    if (mode === "aggregateAllItemData") {
      return { items: [{ data: items }] };
    }

    const field = (this.config.field as string) ?? "";
    if (!field) {
      return { items: [{ aggregated: items }] };
    }
    const values = items.map((it) => pick(it, field)).filter((v) => v !== undefined);
    return { items: [{ [field]: values }] };
  }
}

// ===== Sort =====

export class SortNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const sortBy = (this.config.sortBy as string) ?? "";
    const order = (this.config.order as string) ?? "ascending";

    if (order === "random") {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return { items: arr };
    }

    const sorted = [...items].sort((a, b) => {
      const av = sortBy ? pick(a, sortBy) : a;
      const bv = sortBy ? pick(b, sortBy) : b;
      const cmp = compareValues(av, bv);
      return order === "descending" ? -cmp : cmp;
    });
    return { items: sorted };
  }
}

// ===== Limit =====

export class LimitNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const max = (this.config.maxItems as number) ?? 10;
    const keep = (this.config.keep as string) ?? "firstItems";
    const out = keep === "lastItems" ? items.slice(-max) : items.slice(0, max);
    return { items: out };
  }
}

// ===== Split Out =====

export class SplitOutNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const field = (this.config.fieldToSplitOut as string) ?? "";
    if (!field) return { items };
    const out: Item[] = [];
    for (const it of items) {
      const val = pick(it, field);
      if (Array.isArray(val)) {
        for (const v of val) {
          out.push({ ...it, [field]: v });
        }
      } else if (val !== undefined) {
        out.push({ ...it, [field]: val });
      }
    }
    return { items: out };
  }
}

// ===== Summarize =====

interface AggSpec { fn: "count" | "sum" | "avg" | "min" | "max"; field: string }

export class SummarizeNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const groupBy = (this.config.groupBy as string) ?? "";
    const aggsRaw = (this.config.aggregations as { values?: AggSpec[] } | AggSpec[]) ?? {};
    const aggs: AggSpec[] = Array.isArray(aggsRaw) ? aggsRaw : (aggsRaw.values ?? []);

    const groups: Record<string, Item[]> = {};
    if (groupBy) {
      for (const it of items) {
        const k = String(pick(it, groupBy) ?? "");
        (groups[k] ??= []).push(it);
      }
    } else {
      groups[""] = items;
    }

    const out: Item[] = [];
    for (const [key, members] of Object.entries(groups)) {
      const row: Item = groupBy ? { [groupBy]: key } : {};
      for (const a of aggs) {
        const vals = members
          .map((m) => pick(m, a.field))
          .filter((v) => v !== undefined && v !== null) as number[];
        const colName = `${a.fn}_${a.field || "items"}`;
        switch (a.fn) {
          case "count":
            row[colName] = a.field ? vals.length : members.length;
            break;
          case "sum":
            row[colName] = vals.reduce((s, v) => s + Number(v), 0);
            break;
          case "avg":
            row[colName] = vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : 0;
            break;
          case "min":
            row[colName] = vals.length ? Math.min(...vals.map(Number)) : null;
            break;
          case "max":
            row[colName] = vals.length ? Math.max(...vals.map(Number)) : null;
            break;
        }
      }
      out.push(row);
    }
    return { items: out };
  }
}

// ===== Remove Duplicates =====

export class RemoveDuplicatesNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const items = toItems(inputs);
    const compare = (this.config.compare as string) ?? "allFields";
    const fieldsCsv = (this.config.fields as string) ?? "";
    const fields = fieldsCsv.split(",").map((s) => s.trim()).filter(Boolean);

    const seen = new Set<string>();
    const out: Item[] = [];
    for (const it of items) {
      let key: string;
      if (compare === "selectedFields" && fields.length) {
        key = fields.map((f) => JSON.stringify(pick(it, f) ?? null)).join("|");
      } else {
        key = JSON.stringify(it);
      }
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return { items: out };
  }
}

// ===== DateTime =====

export class DateTimeNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const op = (this.config.operation as string) ?? "format";
    const value = (this.config.value as string) ?? "";
    const format = (this.config.format as string) ?? "yyyy-MM-dd HH:mm:ss";

    const parseDate = (v: string): Date => {
      if (!v) return new Date();
      const d = new Date(v);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const fmt = (d: Date, f: string): string =>
      f
        .replace(/yyyy/g, String(d.getUTCFullYear()))
        .replace(/MM/g, String(d.getUTCMonth() + 1).padStart(2, "0"))
        .replace(/dd/g, String(d.getUTCDate()).padStart(2, "0"))
        .replace(/HH/g, String(d.getUTCHours()).padStart(2, "0"))
        .replace(/mm/g, String(d.getUTCMinutes()).padStart(2, "0"))
        .replace(/ss/g, String(d.getUTCSeconds()).padStart(2, "0"));

    let result: unknown;
    switch (op) {
      case "now":
        result = fmt(new Date(), format);
        break;
      case "format":
        result = fmt(parseDate(value), format);
        break;
      case "add": {
        const d = parseDate(value);
        const amt = Number(this.config.amount ?? 0);
        const unit = (this.config.unit as string) ?? "days";
        const ms = unit === "seconds" ? 1000
          : unit === "minutes" ? 60000
          : unit === "hours" ? 3600000
          : 86400000;
        result = fmt(new Date(d.getTime() + amt * ms), format);
        break;
      }
      case "subtract": {
        const d = parseDate(value);
        const amt = Number(this.config.amount ?? 0);
        const unit = (this.config.unit as string) ?? "days";
        const ms = unit === "seconds" ? 1000
          : unit === "minutes" ? 60000
          : unit === "hours" ? 3600000
          : 86400000;
        result = fmt(new Date(d.getTime() - amt * ms), format);
        break;
      }
      case "diff": {
        const a = parseDate(value);
        const b = parseDate((this.config.endValue as string) ?? "");
        result = (b.getTime() - a.getTime()) / 1000;
        break;
      }
      default:
        result = fmt(parseDate(value), format);
    }
    return { ...inputs, datetime: result };
  }
}

// ===== Wait =====

export class WaitNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    _ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const resume = (this.config.resume as string) ?? "timeInterval";
    if (resume === "timeInterval") {
      const amount = Number(this.config.amount ?? 1);
      const unit = (this.config.unit as string) ?? "seconds";
      const ms = unit === "seconds" ? amount * 1000
        : unit === "minutes" ? amount * 60000
        : unit === "hours" ? amount * 3600000
        : amount * 86400000;
      // Cap to 5s in local SDK execution to avoid hanging tests; longer waits are server-side.
      const capped = Math.min(ms, 5000);
      await new Promise((r) => setTimeout(r, capped));
    }
    // For specificTime / webhook, server-only — passthrough locally
    return inputs;
  }
}

// ===== Triggers (passthrough — execute logic is in the engine/server) =====

export class ScheduleTriggerNode extends SDKBaseNode {
  async execute(): Promise<Record<string, unknown>> {
    return { trigger: "schedule", firedAt: new Date().toISOString() };
  }
}

export class ManualTriggerNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return inputs;
  }
}

// ===== HITL (server-resolved; local stubs) =====

export class HumanApprovalNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Local execution returns approved=true by default for testing.
    // Real flow pauses on the server until a webhook/Slack action resumes.
    return { ...inputs, approved: true, approvedBy: "local-stub" };
  }
}

export class HumanFormNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return { ...inputs, formData: {}, submittedAt: new Date().toISOString() };
  }
}

// ===== Decision Review (delegates to API) =====

export class DecisionReviewNode extends SDKBaseNode {
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Local SDK returns a stub. Real call goes through the workflow client to
    // /v1/decision-review on the API server.
    return {
      ...inputs,
      decision: {
        favorable: [],
        contradicting: [],
        dissenting: [],
        verdict: "pending",
      },
    };
  }
}
