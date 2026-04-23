/**
 * Shared skill import pipeline for all targets.
 * Consolidates common skill import logic to avoid duplication across targets.
 */

import { join, basename, dirname, relative } from 'node:path';
import type { ImportResult } from '../../../core/types.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../../utils/text/markdown.js';
import { serializeImportedSkillWithFallback } from '../import-metadata.js';
import { isReservedArtifactName } from './reserved.js';

export interface SkillImportOptions {
  /** Project root directory */
  projectRoot: string;
  /** Source skills directory (relative to project root) */
  sourceSkillsDir: string;
  /** Destination canonical skills directory (relative to project root) */
  destCanonicalSkillsDir: string;
  /** Target name for import results */
  targetName: string;
  /** Content normalizer function */
  normalize: (content: string, sourceFile: string, destinationFile: string) => string;
  /** Import results array to append to */
  results: ImportResult[];
}

export interface SkillEntry {
  /** Absolute path to the file */
  absolutePath: string;
  /** Relative path within the skill directory */
  relativePath: string;
  /** File content */
  content: string;
}

/**
 * Read a native skill directory and return all files.
 * Filters out reserved artifact names.
 */
export async function readNativeSkill(skillDir: string): Promise<SkillEntry[]> {
  const allFiles = await readDirRecursive(skillDir).catch(() => []);
  const entries: SkillEntry[] = [];

  for (const absPath of allFiles) {
    const relPath = relative(skillDir, absPath).replace(/\\/g, '/');
    const filename = basename(relPath);

    // Skip reserved artifacts
    if (isReservedArtifactName(filename)) {
      continue;
    }

    const content = await readFileSafe(absPath);
    if (content === null) continue;

    entries.push({
      absolutePath: absPath,
      relativePath: relPath,
      content,
    });
  }

  return entries;
}

/**
 * Import a directory-structured skill (with SKILL.md + supporting files).
 */
export async function importDirectorySkill(
  skillName: string,
  skillDir: string,
  options: SkillImportOptions,
): Promise<void> {
  const entries = await readNativeSkill(skillDir);
  const destSkillDir = join(options.projectRoot, options.destCanonicalSkillsDir, skillName);

  for (const entry of entries) {
    const destPath = join(destSkillDir, entry.relativePath);
    await mkdirp(dirname(destPath));

    const normalized = options.normalize(entry.content, entry.absolutePath, destPath);

    // Special handling for SKILL.md
    if (entry.relativePath === 'SKILL.md') {
      const { frontmatter, body } = parseFrontmatter(normalized);
      const outContent = await serializeImportedSkillWithFallback(
        destPath,
        { ...frontmatter, name: skillName },
        body,
      );
      await writeFileAtomic(destPath, outContent);
    } else {
      await writeFileAtomic(destPath, normalized);
    }

    options.results.push({
      fromTool: options.targetName,
      fromPath: entry.absolutePath,
      toPath: `${options.destCanonicalSkillsDir}/${skillName}/${entry.relativePath}`,
      feature: 'skills',
    });
  }
}

/**
 * Import a flat skill file (single .md file → SKILL.md).
 */
export async function importFlatSkill(
  skillName: string,
  srcPath: string,
  content: string,
  options: SkillImportOptions,
): Promise<void> {
  const destSkillDir = join(options.projectRoot, options.destCanonicalSkillsDir, skillName);
  await mkdirp(destSkillDir);

  const destPath = join(destSkillDir, 'SKILL.md');
  const normalized = options.normalize(content, srcPath, destPath);
  const { frontmatter, body } = parseFrontmatter(normalized);

  const outContent = await serializeImportedSkillWithFallback(
    destPath,
    { ...frontmatter, name: skillName },
    body,
  );
  await writeFileAtomic(destPath, outContent);

  options.results.push({
    fromTool: options.targetName,
    fromPath: srcPath,
    toPath: `${options.destCanonicalSkillsDir}/${skillName}/SKILL.md`,
    feature: 'skills',
  });
}

/**
 * Find all directory-structured skills (containing SKILL.md).
 * Returns map of skill name → skill directory path.
 */
export async function findDirectorySkills(skillsDir: string): Promise<Map<string, string>> {
  const skills = new Map<string, string>();

  try {
    const allFiles = await readDirRecursive(skillsDir);
    const skillMdFiles = allFiles.filter((f) => basename(f) === 'SKILL.md');

    for (const skillMdPath of skillMdFiles) {
      const skillDir = dirname(skillMdPath);
      const skillName = basename(skillDir);
      skills.set(skillName, skillDir);
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return skills;
}

/**
 * Normalize projected agent skill content by removing projection-specific frontmatter.
 * Used when importing skills that were generated from agents.
 */
export function normalizeProjectedAgentSkill(content: string): string {
  const { frontmatter, body } = parseFrontmatter(content);

  // Remove projection-specific fields
  const {
    projected_from_agent: _projected,
    agent_name: _agentName,
    ...cleanFrontmatter
  } = frontmatter as Record<string, unknown>;

  // If no frontmatter left, return just body
  if (Object.keys(cleanFrontmatter).length === 0) {
    return body;
  }

  // Reconstruct with cleaned frontmatter
  const fmLines = Object.entries(cleanFrontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `---\n${fmLines}\n---\n\n${body}`;
}
