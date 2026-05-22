/**
 * Skill-repo staging helpers used when copying a standalone skill repo into
 * the install pipeline. Boilerplate vocabulary is owned by
 * `src/install/importers/boilerplate-filter.ts` — this module only composes
 * those predicates with skill-frontmatter sanitization and a filtered `cp`.
 */

import { relative } from 'node:path';
import { cp } from 'node:fs/promises';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { tryParseFrontmatter } from '../../utils/text/markdown.js';
import {
  isNoiseBoilerplate,
  isRepoNonContentDir,
  isRepoNonContentFile,
} from '../importers/boilerplate-filter.js';

/** Read SKILL.md frontmatter to extract a sanitized name, if present. */
export async function readSkillFrontmatterName(skillMdPath: string): Promise<string> {
  const content = await readFileSafe(skillMdPath);
  if (!content) return '';
  const parsed = tryParseFrontmatter(content, skillMdPath);
  if (!parsed.ok) return '';
  const { frontmatter } = parsed.value;
  if (typeof frontmatter.name !== 'string') return '';
  return frontmatter.name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Copy a repo-root skill directory filtering out repo boilerplate. */
export async function cpFilteredSkill(sourceRoot: string, destDir: string): Promise<void> {
  await cp(sourceRoot, destDir, {
    recursive: true,
    filter: (src: string): boolean => {
      const rel = relative(sourceRoot, src).replace(/\\/g, '/');
      if (rel === '') return true;
      const first = rel.split('/')[0]!;
      if (isRepoNonContentDir(first)) return false;
      if (!rel.includes('/')) {
        // Drop noise (CHANGELOG / CONTRIBUTING / CODE_OF_CONDUCT / ...) but
        // keep preserved files (LICENSE / NOTICE / COPYING / README) so they
        // travel with the staged skill copy.
        if (isNoiseBoilerplate(rel)) return false;
        if (isRepoNonContentFile(rel)) return false;
      }
      return true;
    },
  });
}
