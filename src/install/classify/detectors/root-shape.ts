/**
 * Detect root-level "single-marker" shapes: canonical `.agentsmesh/`,
 * legacy single-file root rules, and a root-level `SKILL.md`.
 */

import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { dirExists, listDirEntries } from './fs-helpers.js';
import type { CanonicalRoot, RootRule, RootSkill } from '../layout-types.js';

const CANONICAL_MARKERS = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp.json',
  'hooks.yaml',
  'permissions.yaml',
  'ignore',
];

/**
 * Legacy single-file rule formats: `.cursorrules` (Cursor) and `.windsurfrules`
 * (Windsurf). Ordered by preference: when both exist (e.g. devin.cursorrules),
 * `.cursorrules` wins because Cursor's format is the more widely-cited source.
 */
const ROOT_RULE_FILES = ['.cursorrules', '.windsurfrules'];

export async function detectCanonical(root: string): Promise<CanonicalRoot | null> {
  const agentsmeshDir = join(root, '.agentsmesh');
  if (!(await dirExists(agentsmeshDir))) return null;
  const entries = await listDirEntries(agentsmeshDir);
  const names = new Set(entries.map((e) => e.name));
  for (const marker of CANONICAL_MARKERS) {
    if (names.has(marker)) return { path: '.agentsmesh' };
  }
  return null;
}

export async function detectRootRule(root: string): Promise<RootRule | null> {
  for (const name of ROOT_RULE_FILES) {
    try {
      const s = await stat(join(root, name));
      if (s.isFile()) return { path: name };
    } catch {
      // missing — try next candidate
    }
  }
  return null;
}

export async function detectRootSkill(root: string): Promise<RootSkill | null> {
  try {
    const skillMd = await stat(join(root, 'SKILL.md'));
    if (skillMd.isFile()) return { path: 'SKILL.md' };
  } catch {
    // missing or unreadable — fall through
  }
  return null;
}
