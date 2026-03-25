/**
 * Skill name discovery from native skill trees (SKILL.md + flat *.md).
 */

import { basename, dirname, relative } from 'node:path';
import { readDirRecursive } from '../utils/fs.js';

/** Names from `.../{name}/SKILL.md` plus top-level `*.md` in scanRoot (flat skills). */
export async function skillNamesFromNativeSkillDir(scanRoot: string): Promise<string[]> {
  const files = await readDirRecursive(scanRoot);
  const names = new Set<string>();
  for (const f of files) {
    if (basename(f) === 'SKILL.md') {
      names.add(basename(dirname(f)));
      continue;
    }
    const rel = relative(scanRoot, f).replace(/\\/g, '/');
    if (!rel.includes('/') && f.toLowerCase().endsWith('.md')) {
      names.add(basename(f, '.md'));
    }
  }
  return [...names].filter(Boolean).sort();
}
