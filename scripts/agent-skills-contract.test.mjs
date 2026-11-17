import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, ".agents", "skills");
const skillDirs = readdirSync(skillsRoot)
  .filter((name) => !name.startsWith("_"))
  .filter((name) => statSync(path.join(skillsRoot, name)).isDirectory());

const names = new Map();
const failures = [];

for (const dir of skillDirs) {
  const skillDir = path.join(skillsRoot, dir);
  const skillPath = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    failures.push(dir + ": missing SKILL.md");
    continue;
  }

  const source = readFileSync(skillPath, "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    failures.push(dir + ": missing YAML frontmatter");
    continue;
  }

  const name = frontmatter[1].match(/^name:\s*["']?([a-z0-9-]+)["']?\s*$/m)?.[1];
  const hasDescription = /^description:\s*(?:>[-+]?|["'][^"']+["']|\S.*)$/m.test(frontmatter[1]);
  if (!name) failures.push(dir + ": missing or invalid name");
  if (!hasDescription) failures.push(dir + ": missing description");
  if (name && name !== dir) failures.push(dir + ': frontmatter name is "' + name + '"');
  if (name && names.has(name)) failures.push(dir + ": duplicate skill name also used by " + names.get(name));
  if (name) names.set(name, dir);

  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const target = rawTarget.split("#", 1)[0].split("?", 1)[0];
    if (!target) continue;
    const resolved = path.resolve(skillDir, target);
    if (!resolved.startsWith(skillsRoot + path.sep) && resolved !== skillsRoot) {
      failures.push(dir + ": link escapes skill directory: " + rawTarget);
      continue;
    }
    if (!existsSync(resolved)) failures.push(dir + ": broken local link: " + rawTarget);
  }
}

assert.deepEqual(failures, [], failures.join("\n"));
console.log("Agent skills contract: " + skillDirs.length + " skill folders checked; " + names.size + " unique names; local links valid.");
