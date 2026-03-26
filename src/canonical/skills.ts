/**
 * Parse .agentsmesh/skills/{name}/SKILL.md into CanonicalSkill objects.
 */

import { basename, join } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { CanonicalSkill, SkillSupportingFile } from '../core/types.js';
import { readFileSafe, readDirRecursive } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/markdown.js';

/** Read file content; returns empty string if unreadable */
async function readContent(path: string): Promise<string> {
  const c = await readFileSafe(path);
  return c ?? '';
}

const SKILL_FILE = 'SKILL.md';

/** Directories that are never valid skill supporting content. */
const EXCLUDED_DIR_PREFIXES = ['.git', 'node_modules'];

/** Sanitize a frontmatter name into a valid directory/skill name. */
function sanitizeSkillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * List supporting files in a skill directory (all files except SKILL.md).
 * @param skillDir - Absolute path to skill directory
 * @returns Supporting files with relative and absolute paths
 */
async function listSupportingFiles(skillDir: string): Promise<SkillSupportingFile[]> {
  const files = await readDirRecursive(skillDir);
  const result: SkillSupportingFile[] = [];
  for (const absPath of files) {
    const raw = absPath.slice(skillDir.length + 1);
    const name = raw.replace(/\\/g, '/');
    if (name === SKILL_FILE || name.endsWith(`/${SKILL_FILE}`)) continue;
    const firstSegment = name.split('/')[0]!;
    if (EXCLUDED_DIR_PREFIXES.some((p) => firstSegment === p)) continue;
    if (name === '.DS_Store' || name.endsWith('/.DS_Store')) continue;
    const content = await readContent(absPath);
    result.push({ relativePath: name, absolutePath: absPath, content });
  }
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Parse all skill directories under skillsDir.
 * Each skill lives in skillsDir/{name}/SKILL.md.
 * @param skillsDir - Absolute path to .agentsmesh/skills
 * @returns Array of parsed CanonicalSkill, or [] if dir missing/empty
 */
/**
 * Parse a single skill directory containing SKILL.md (Anthropic-style leaf folder).
 */
export async function parseSkillDirectory(skillDir: string): Promise<CanonicalSkill | null> {
  const skillPath = join(skillDir, SKILL_FILE);
  const content = await readFileSafe(skillPath);
  if (!content) return null;
  const { frontmatter, body } = parseFrontmatter(content);
  const supportingFiles = await listSupportingFiles(skillDir);
  const fmName = typeof frontmatter.name === 'string' ? sanitizeSkillName(frontmatter.name) : '';
  return {
    source: skillPath,
    name: fmName || basename(skillDir),
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    body,
    supportingFiles,
  };
}

export async function parseSkills(skillsDir: string): Promise<CanonicalSkill[]> {
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: CanonicalSkill[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillDir = join(skillsDir, ent.name);
    const skillPath = join(skillDir, SKILL_FILE);
    const content = await readFileSafe(skillPath);
    if (!content) continue;
    const { frontmatter, body } = parseFrontmatter(content);
    const supportingFiles = await listSupportingFiles(skillDir);
    skills.push({
      source: skillPath,
      name: ent.name,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      body,
      supportingFiles,
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
