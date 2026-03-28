import { SDKBaseNode } from "./base.js";
import type { SDKExecutionContext } from "./base.js";

export class VariableNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const mode = (this.config.mode as string) ?? "set_get";
    let result: Record<string, unknown> = {};

    if (mode === "set" || mode === "set_get") {
      const vars = (this.config.variables as Record<string, unknown>) ?? {};
      for (const [key, value] of Object.entries(vars)) {
        ctx.setVar(key, value);
      }
      for (const [key, value] of Object.entries(inputs)) {
        ctx.setVar(key, value);
      }
    }

    if (mode === "get" || mode === "set_get") {
      const keys = (this.config.keys as string[]) ?? [];
      if (keys.length) {
        for (const key of keys) {
          result[key] = ctx.getVar(key);
        }
      } else {
        result = { ...ctx.variables };
      }
    }

    return result;
  }
}

function formatItem(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    const text =
      (obj.text as string) ??
      ((obj.metadata as Record<string, unknown>)?.text as string) ??
      "";
    const score = obj.score;
    const parts = [text];
    if (score != null && score !== "") {
      parts.push(`(score: ${score})`);
    }
    return parts.join(" ");
  }
  return String(item);
}

export class PromptTemplateNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
    ctx: SDKExecutionContext,
  ): Promise<Record<string, unknown>> {
    const template = (this.config.template as string) ?? "{{query}}";
    const systemPromptTemplate = (this.config.system_prompt as string) ?? "";

    function replaceVar(_match: string, varName: string): string {
      const name = varName.trim();
      const value = inputs[name] ?? ctx.getVar(name, "");
      if (Array.isArray(value)) {
        return value.map((v) => `- ${formatItem(v)}`).join("\n");
      }
      return String(value);
    }

    const prompt = template.replace(/\{\{(.+?)\}\}/g, replaceVar);
    const systemPrompt = systemPromptTemplate.replace(
      /\{\{(.+?)\}\}/g,
      replaceVar,
    );
    return { prompt, system_prompt: systemPrompt };
  }
}

export class AnswerNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let text = (inputs.text as string) ?? "";
    const results = (inputs.results as Record<string, unknown>[]) ?? [];
    const fmt = (this.config.format as string) ?? "text";
    const includeSources = (this.config.include_sources as boolean) ?? true;
    const maxLength = this.config.max_length as number | undefined;

    if (maxLength && text.length > maxLength) {
      text = text.slice(0, maxLength) + "...";
    }

    const sources: Record<string, unknown>[] = [];
    if (includeSources && results.length) {
      for (const r of results) {
        const source: Record<string, unknown> = {
          id: r.id ?? "",
          score: r.score ?? 0,
        };
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        if (meta.source) source.source = meta.source;
        if (meta.text) source.snippet = String(meta.text).slice(0, 200);
        sources.push(source);
      }
    }

    let answer: string;
    if (fmt === "markdown" && sources.length) {
      const sourceSection =
        "\n\n---\n**Sources:**\n" +
        sources
          .map(
            (s) =>
              `- ${s.source ?? s.id} (score: ${s.score ?? "N/A"})`,
          )
          .join("\n");
      answer = text + sourceSection;
    } else if (fmt === "json") {
      answer = JSON.stringify({ text, sources });
    } else {
      answer = text;
    }

    return { answer, sources, format: fmt };
  }
}

export class ModelSelectorNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const model = (this.config.model as string) ?? "";
    return { model, ...inputs };
  }
}

function resolvePath(data: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;

  for (let i = 0; i < parts.length; i++) {
    if (current == null) return null;
    const part = parts[i];
    const m = part.match(/^(\w+)\[(\d*)\]$/);

    if (m) {
      const key = m[1];
      const idx = m[2];
      current =
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : null;
      if (current == null) return null;

      if (idx) {
        const idxInt = parseInt(idx, 10);
        if (Array.isArray(current) && idxInt < current.length) {
          current = current[idxInt];
        } else {
          return null;
        }
      } else {
        const remaining = parts.slice(i + 1).join(".");
        if (!remaining) return current;
        if (Array.isArray(current)) {
          const results = current.map((item) => resolvePath(item, remaining));
          const flat: unknown[] = [];
          for (const r of results) {
            if (Array.isArray(r)) {
              flat.push(...r);
            } else if (r != null) {
              flat.push(r);
            }
          }
          return flat;
        }
        return null;
      }
    } else {
      current =
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : null;
    }
  }

  return current;
}

export class FieldSelectorNode extends SDKBaseNode {
  async execute(
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const fields = (this.config.fields as string[]) ?? [];
    const rename = (this.config.rename as Record<string, string>) ?? {};
    const flatten = (this.config.flatten as boolean) ?? false;

    if (!fields.length) {
      return { out: {}, columns: {} };
    }

    let data: unknown = inputs.in ?? inputs;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    let result: Record<string, unknown> = {};
    const columns: Record<string, unknown> = {};

    for (const fieldPath of fields) {
      const outputKey =
        rename[fieldPath] ?? fieldPath.replace(/\[\]/g, "").replace(/\./g, "_");
      const value = resolvePath(data, fieldPath);
      result[outputKey] = value;
      if (Array.isArray(value)) {
        columns[outputKey] = value;
      }
    }

    if (flatten) {
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(
            v as Record<string, unknown>,
          )) {
            flat[`${k}_${sk}`] = sv;
          }
        } else {
          flat[k] = v;
        }
      }
      result = flat;
    }

    return { out: result, columns };
  }
}
