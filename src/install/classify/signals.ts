/**
 * Pure predicates that score the five classifier signals against a
 * `contentRoot`. None of these functions throw on missing directories —
 * absent evidence simply returns `false`.
 */

import { join } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { isBoilerplate } from '../importers/boilerplate-filter.js';

export interface SignalContext {
  readonly contentRoot: string;
}

const KEBAB_DIR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function listEntries(
  dir: string,
): Promise<ReadonlyArray<{ name: string; isDirectory: boolean; isFile: boolean }>> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  } catch {
    return [];
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

async function readFrontmatterKeys(path: string): Promise<ReadonlySet<string>> {
  try {
    const raw = await readFile(path, 'utf-8');
    const { frontmatter } = parseFrontmatter(raw);
    return new Set(Object.keys(frontmatter));
  } catch {
    return new Set();
  }
}

/**
 * PRIMARY signal: contentRoot has at least one `skills/<kebab>/SKILL.md`
 * whose frontmatter declares `name` or `description`.
 */
export async function hasSkillPackLayout(ctx: SignalContext): Promise<boolean> {
  const skillsDir = join(ctx.contentRoot, 'skills');
  const entries = await listEntries(skillsDir);
  for (const ent of entries) {
    if (!ent.isDirectory) continue;
    if (ent.name.startsWith('_')) continue;
    if (!KEBAB_DIR.test(ent.name)) continue;
    const skillMd = join(skillsDir, ent.name, 'SKILL.md');
    if (!(await fileExists(skillMd))) continue;
    const keys = await readFrontmatterKeys(skillMd);
    if (keys.has('name') || keys.has('description')) return true;
  }
  return false;
}

/**
 * Secondary signal: contentRoot has `agents/<name>.md` with non-empty
 * frontmatter, excluding README/LICENSE/etc. boilerplate.
 */
export async function hasAgentsDir(ctx: SignalContext): Promise<boolean> {
  const agentsDir = join(ctx.contentRoot, 'agents');
  const entries = await listEntries(agentsDir);
  for (const ent of entries) {
    if (!ent.isFile) continue;
    if (!ent.name.toLowerCase().endsWith('.md')) continue;
    if (isBoilerplate(ent.name)) continue;
    if (ent.name.startsWith('_')) continue;
    const keys = await readFrontmatterKeys(join(agentsDir, ent.name));
    if (keys.size > 0) return true;
  }
  return false;
}

/**
 * Secondary signal: contentRoot has `references/<name>.md` (non-boilerplate).
 */
export async function hasReferencesDir(ctx: SignalContext): Promise<boolean> {
  const refsDir = join(ctx.contentRoot, 'references');
  const entries = await listEntries(refsDir);
  for (const ent of entries) {
    if (!ent.isFile) continue;
    if (!ent.name.toLowerCase().endsWith('.md')) continue;
    if (isBoilerplate(ent.name)) continue;
    return true;
  }
  return false;
}

/**
 * Secondary signal: ≥2 of CLAUDE.md / AGENTS.md / GEMINI.md exist at root.
 * Case-sensitive name match via readdir so case-insensitive filesystems
 * (macOS APFS/HFS+, Windows NTFS default) do not produce false positives
 * on lowercase variants. Real Anthropic-style packs always use uppercase.
 */
export async function hasMultiToolRules(ctx: SignalContext): Promise<boolean> {
  const targets = new Set(['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']);
  const entries = await listEntries(ctx.contentRoot);
  let count = 0;
  for (const ent of entries) {
    if (!ent.isFile) continue;
    if (!targets.has(ent.name)) continue;
    count += 1;
    if (count >= 2) return true;
  }
  return false;
}

/**
 * Secondary signal: ≥1 `.md` file lives under any of the recognized
 * per-target command directories.
 */
export async function hasPerTargetCommands(ctx: SignalContext): Promise<boolean> {
  const dirs = ['.claude/commands', '.gemini/commands', '.cursor/commands'];
  for (const rel of dirs) {
    const entries = await listEntries(join(ctx.contentRoot, rel));
    for (const ent of entries) {
      if (!ent.isFile) continue;
      if (!ent.name.toLowerCase().endsWith('.md')) continue;
      if (isBoilerplate(ent.name)) continue;
      return true;
    }
  }
  return false;
}
