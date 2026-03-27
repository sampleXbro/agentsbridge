/**
 * Load Anthropic-style skill directories for extends.path (no .agentsmesh).
 */

import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { CanonicalSkill } from '../../core/types.js';
import { exists } from '../../utils/filesystem/fs.js';
import { parseSkillDirectory, parseSkills } from '../features/skills.js';

const SKILL = 'SKILL.md';

/** True if root is a single skill folder or a directory of skill subfolders. */
export async function isSkillPackLayout(root: string): Promise<boolean> {
  if (!(await exists(root))) return false;
  if (await exists(join(root, SKILL))) return true;
  try {
    const ents = await readdir(root, { withFileTypes: true });
    for (const e of ents) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      if (await exists(join(root, e.name, SKILL))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Parse skills at path (registry or single skill leaf). */
export async function loadSkillsAtExtendPath(skillsRoot: string): Promise<CanonicalSkill[]> {
  if (!(await exists(skillsRoot))) return [];
  if (await exists(join(skillsRoot, SKILL))) {
    const one = await parseSkillDirectory(skillsRoot);
    return one ? [one] : [];
  }
  return parseSkills(skillsRoot);
}
