import { SDKBaseNode } from "./base.js";
import type { SDKExecutionContext } from "./base.js";

export class ConditionNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const field = (this.config.field as string) ?? "";
    const operator = (this.config.operator as string) ?? "eq";
    const expected = this.config.value;
    const actual = inputs[field];
    const result = ConditionNode.evaluate(actual, operator, expected);
    return { branch: result ? "true" : "false", data: inputs };
  }

  static evaluate(actual: unknown, op: string, expected: unknown): boolean {
    switch (op) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return Number(actual ?? 0) > Number(expected ?? 0);
      case "lt":
        return Number(actual ?? 0) < Number(expected ?? 0);
      case "gte":
        return Number(actual ?? 0) >= Number(expected ?? 0);
      case "lte":
        return Number(actual ?? 0) <= Number(expected ?? 0);
      case "contains":
        return String(actual ?? "").includes(String(expected ?? ""));
      case "empty":
        return !actual;
      case "not_empty":
        return Boolean(actual);
      default:
        return false;
    }
  }
}

export class MergeNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return { merged: inputs };
  }
}

export class LoopNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const inputKey = (this.config.input_key as string) ?? "items";
    const itemKey = (this.config.item_key as string) ?? "item";
    const indexKey = (this.config.index_key as string) ?? "index";
    const maxIter = (this.config.max_iterations as number) ?? 100;

    let items = inputs[inputKey];
    if (!Array.isArray(items)) {
      items = items != null ? [items] : [];
    }
    const arr = items as unknown[];

    if (arr.length > maxIter) {
      throw new Error(
        `Loop has ${arr.length} items, exceeds max_iterations=${maxIter}`,
      );
    }

    const iterations = arr.map((item, i) => ({
      [itemKey]: item,
      [indexKey]: i,
      total: arr.length,
      is_last: i === arr.length - 1,
    }));

    ctx.setVar(`${this.block.id}.iterations`, iterations);
    ctx.setVar(`${this.block.id}.count`, arr.length);

    return {
      iterations,
      count: arr.length,
      [itemKey]: arr.length > 0 ? arr[0] : null,
      [indexKey]: 0,
      total: arr.length,
      is_last: arr.length <= 1,
    };
  }

  validateConfig(): string[] {
    const errors: string[] = [];
    const maxIter = this.config.max_iterations;
    if (maxIter != null && (typeof maxIter !== "number" || maxIter < 1)) {
      errors.push("max_iterations must be a positive integer");
    }
    return errors;
  }
}

export class RouterNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const query = String(inputs.query ?? "").toLowerCase();
    const strategy = (this.config.strategy as string) ?? "keyword";
    const routes = (this.config.routes as Record<string, unknown>[]) ?? [];
    const defaultRoute = (this.config.default_route as string) ?? "default";

    if (!query || !routes.length) {
      return { route: defaultRoute, confidence: 0.0, data: inputs };
    }

    if (strategy === "keyword") {
      return RouterNode.routeKeyword(query, routes, defaultRoute, inputs);
    } else if (strategy === "regex") {
      return RouterNode.routeRegex(query, routes, defaultRoute, inputs);
    } else if (strategy === "llm") {
      throw new Error(
        "LLM-based routing is not supported in the SDK engine. " +
          "Use 'keyword' or 'regex' strategy, or register a custom node.",
      );
    }
    return { route: defaultRoute, confidence: 0.0, data: inputs };
  }

  static routeKeyword(
    query: string,
    routes: Record<string, unknown>[],
    defaultRoute: string,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    let bestRoute = defaultRoute;
    let bestScore = 0;
    for (const route of routes) {
      const name = (route.name as string) ?? "";
      let keywords = route.condition;
      if (typeof keywords === "string") {
        keywords = keywords.split(",").map((k: string) => k.trim());
      }
      const kwArr = (keywords as string[]) ?? [];
      const hits = kwArr.filter((kw) => query.includes(kw.toLowerCase())).length;
      const score = hits / Math.max(kwArr.length, 1);
      if (score > bestScore) {
        bestScore = score;
        bestRoute = name;
      }
    }
    return { route: bestRoute, confidence: bestScore, data: inputs };
  }

  static routeRegex(
    query: string,
    routes: Record<string, unknown>[],
    defaultRoute: string,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    for (const route of routes) {
      const name = (route.name as string) ?? "";
      const pattern = (route.condition as string) ?? "";
      if (pattern && new RegExp(pattern, "i").test(query)) {
        return { route: name, confidence: 1.0, data: inputs };
      }
    }
    return { route: defaultRoute, confidence: 0.0, data: inputs };
  }
}
