import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SkillLoader, SkillResolver } from "../skills.js";

describe("SkillLoader/SkillResolver", () => {
  it("loads markdown skills from discovery paths", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      writeFileSync(
        resolve(dir, "alpha.md"),
        `---\nname: alpha-skill\ndescription: Alpha skill\n---\n\nBody A`,
        "utf-8",
      );

      mkdirSync(resolve(dir, "nested"), { recursive: true });
      writeFileSync(
        resolve(dir, "nested", "SKILL.md"),
        `---\nname: beta-skill\ndescription: Beta skill\nallowed-tools: foo bar\n---\n\nBody B`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      const summaries = await loader.loadAll();
      expect(summaries.map((s) => s.name).sort()).toEqual(["alpha-skill", "beta-skill"]);

      const beta = await loader.get("beta-skill");
      expect(beta?.meta["allowed-tools"]).toEqual(["foo", "bar"]);
      expect(beta?.body).toContain("Body B");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("buildPromptSection returns prompt and allowed tool set", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      writeFileSync(
        resolve(dir, "alpha.md"),
        `---\nname: alpha-skill\ndescription: Alpha skill\nallowed-tools: foo\n---\n\nAlpha body`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();
      const resolver = new SkillResolver(loader);

      const skills = await resolver.resolve("anything");
      const section = resolver.buildPromptSection(skills);

      expect(section.promptText).toContain("Skill: alpha-skill");
      expect(section.allowedTools && section.allowedTools.has("foo")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("selects one primary skill with deterministic tie-break", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      writeFileSync(
        resolve(dir, "customer.md"),
        `---\nname: customer-support\ndescription: Handle refund policy questions\n---\n\nSupport body`,
        "utf-8",
      );
      writeFileSync(
        resolve(dir, "zeta.md"),
        `---\nname: zeta-support\ndescription: Handle refund policy questions\n---\n\nZeta body`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();
      const resolver = new SkillResolver(loader);

      const resolved = await resolver.resolvePrimary("refund policy");

      expect(resolved).toBeDefined();
      expect(resolved?.skill.meta.name).toBe("customer-support");
      expect(typeof resolved?.score).toBe("number");
      expect(resolved?.reason).toBe("keyword overlap");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns undefined when top primary score is zero", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      writeFileSync(
        resolve(dir, "alpha.md"),
        `---\nname: alpha-skill\ndescription: Handles alpha requests\n---\n\nAlpha body`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      await loader.loadAll();
      const resolver = new SkillResolver(loader);

      const resolved = await resolver.resolvePrimary("totally unrelated query tokens");

      expect(resolved).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on duplicate skill name", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      const firstPath = resolve(dir, "first.md");
      const secondPath = resolve(dir, "second.md");

      writeFileSync(
        firstPath,
        `---\nname: duplicate-skill\ndescription: First description\n---\n\nFirst body`,
        "utf-8",
      );
      writeFileSync(
        secondPath,
        `---\nname: duplicate-skill\ndescription: Second description\n---\n\nSecond body`,
        "utf-8",
      );

      const loader = new SkillLoader(dir);

      await expect(loader.loadAll()).rejects.toThrow(/Duplicate skill name "duplicate-skill"/);
      await expect(loader.loadAll()).rejects.toThrow(firstPath);
      await expect(loader.loadAll()).rejects.toThrow(secondPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses frontmatter with CRLF line endings", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "skills-"));
    try {
      writeFileSync(
        resolve(dir, "crlf.md"),
        "---\r\nname: crlf-skill\r\ndescription: CRLF skill\r\nallowed-tools: foo bar\r\n---\r\n\r\nBody CRLF",
        "utf-8",
      );

      const loader = new SkillLoader(dir);
      const summaries = await loader.loadAll();
      expect(summaries.map((s) => s.name)).toContain("crlf-skill");

      const skill = await loader.get("crlf-skill");
      expect(skill?.meta.name).toBe("crlf-skill");
      expect(skill?.meta["allowed-tools"]).toEqual(["foo", "bar"]);
      expect(skill?.body).toContain("Body CRLF");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
