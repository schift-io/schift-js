import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, extname, basename } from "node:path";

export interface SkillFrontmatter {
  name: string;
  description: string;
  model?: string;
  "allowed-tools"?: string[];
  "blocked-tools"?: string[];
  procedures?: string[];
  constraints?: string[];
  rag?: string;
  "execution-pipeline"?: boolean;
  template?: boolean;
}

export interface Skill {
  meta: SkillFrontmatter;
  body: string;
  filePath: string;
}

export interface SkillSummary {
  name: string;
  description: string;
}

export interface ResolvedSkill {
  skill: Skill;
  score: number;
  reason: string;
}

interface SkillLoaderOptions {
  includeBody?: boolean;
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function parseStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\s+/).map((v) => v.trim()).filter(Boolean);
  }
  return undefined;
}

function parseFrontmatterFallback(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;

    if (key === "allowed-tools" || key === "blocked-tools" || key === "procedures" || key === "constraints") {
      out[key] = parseStringList(value);
      continue;
    }

    if (value === "true" || value === "false") {
      out[key] = parseBoolean(value);
      continue;
    }

    out[key] = value;
  }
  return out;
}

async function parseFrontmatter(raw: string): Promise<Record<string, unknown>> {
  try {
    const mod = await import("js-yaml");
    const parsed = mod.load(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return {};
  } catch {
    return parseFrontmatterFallback(raw);
  }
}

function findSkillMarkdownFiles(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return [];

  const files: string[] = [];
  const stack = [skillsDir];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const ext = extname(fullPath).toLowerCase();
      const base = basename(fullPath);
      if (ext === ".md" || base === "SKILL.md") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function validateSkillMeta(meta: Record<string, unknown>, filePath: string): SkillFrontmatter {
  const name = String(meta.name ?? "").trim();
  const description = String(meta.description ?? "").trim();

  if (!name || name.length < 1 || name.length > 64) {
    throw new Error(`Invalid skill name in ${filePath}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Skill name must be kebab-case in ${filePath}`);
  }
  if (!description || description.length < 1 || description.length > 1024) {
    throw new Error(`Invalid skill description in ${filePath}`);
  }

  return {
    name,
    description,
    model: typeof meta.model === "string" ? meta.model : undefined,
    "allowed-tools": parseStringList(meta["allowed-tools"]),
    "blocked-tools": parseStringList(meta["blocked-tools"]),
    procedures: parseStringList(meta.procedures),
    constraints: parseStringList(meta.constraints),
    rag: typeof meta.rag === "string" ? meta.rag : undefined,
    "execution-pipeline": typeof meta["execution-pipeline"] === "boolean" ? meta["execution-pipeline"] : undefined,
    template: typeof meta.template === "boolean" ? meta.template : undefined,
  };
}

export class SkillLoader {
  private readonly skills = new Map<string, Skill>();

  constructor(private readonly skillsDir: string) {}

  async loadAll(options?: SkillLoaderOptions): Promise<SkillSummary[]> {
    const files = findSkillMarkdownFiles(this.skillsDir);
    this.skills.clear();

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const { frontmatterRaw, body } = this.extract(content);
      const frontmatter = await parseFrontmatter(frontmatterRaw);
      const meta = validateSkillMeta(frontmatter, filePath);

      const existing = this.skills.get(meta.name);
      if (existing) {
        throw new Error(
          `Duplicate skill name "${meta.name}" found in ${existing.filePath} and ${filePath}`,
        );
      }

      const skill: Skill = {
        meta,
        body: options?.includeBody === false ? "" : body,
        filePath,
      };
      this.skills.set(meta.name, skill);
    }

    return [...this.skills.values()].map((s) => ({
      name: s.meta.name,
      description: s.meta.description,
    }));
  }

  async get(name: string): Promise<Skill | undefined> {
    if (!this.skills.size) {
      await this.loadAll();
    }
    return this.skills.get(name);
  }

  async getAll(): Promise<Skill[]> {
    if (!this.skills.size) {
      await this.loadAll();
    }
    return [...this.skills.values()];
  }

  async reload(name: string): Promise<Skill | undefined> {
    const all = await this.loadAll();
    if (!all.some((s) => s.name === name)) return undefined;
    return this.skills.get(name);
  }

  private extract(content: string): { frontmatterRaw: string; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      throw new Error("Skill markdown must contain frontmatter block");
    }

    return {
      frontmatterRaw: match[1],
      body: match[2] ?? "",
    };
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scoreSkill(query: string, skill: Skill): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;
  const haystack = `${skill.meta.name} ${skill.meta.description}`.toLowerCase();
  let score = 0;
  for (const token of qTokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

export class SkillResolver {
  constructor(private readonly loader: SkillLoader) {}

  async resolve(_query: string): Promise<Skill[]> {
    return this.loader.getAll();
  }

  async resolvePrimary(query: string): Promise<ResolvedSkill | undefined> {
    const skills = await this.loader.getAll();
    if (skills.length === 0) return undefined;

    const ranked = skills
      .map((skill) => ({
        skill,
        score: scoreSkill(query, skill),
        reason: "keyword overlap",
      }))
      .sort((a, b) => (b.score - a.score) || a.skill.meta.name.localeCompare(b.skill.meta.name));

    if (!ranked[0] || ranked[0].score <= 0) return undefined;

    return ranked[0];
  }

  buildPromptSection(skills: Skill[]): {
    promptText: string;
    allowedTools: Set<string> | null;
  } {
    if (skills.length === 0) {
      return { promptText: "", allowedTools: null };
    }

    const blocks = skills.map((skill) => {
      return `## Skill: ${skill.meta.name}\n${skill.meta.description}\n\n${skill.body.trim()}`.trim();
    });

    const allowed = new Set<string>();
    let hasRestriction = false;
    for (const skill of skills) {
      const names = skill.meta["allowed-tools"];
      if (!names || names.length === 0) continue;
      hasRestriction = true;
      for (const n of names) allowed.add(n);
    }

    return {
      promptText: `\n\n[Loaded Skills]\n${blocks.join("\n\n")}`,
      allowedTools: hasRestriction ? allowed : null,
    };
  }
}

export async function loadSkills(path: string): Promise<SkillLoader> {
  const loader = new SkillLoader(resolve(path));
  await loader.loadAll({ includeBody: false });
  return loader;
}
