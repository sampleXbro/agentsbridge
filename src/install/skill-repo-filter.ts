/**
 * Filter repo boilerplate when staging standalone skill repos for install.
 */

import { relative } from 'node:path';
import { cp } from 'node:fs/promises';
import { readFileSafe } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/markdown.js';

/** Files at repo root that are not skill content. */
const REPO_BOILERPLATE_FILES = new Set([
  'README.md',
  'README.rst',
  'README.txt',
  'README',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENSE-MIT',
  'LICENSE-APACHE',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.DS_Store',
]);

/** Directories at repo root that are not skill content. */
const REPO_BOILERPLATE_DIRS = new Set([
  '.git',
  '.github',
  '.gitlab',
  'node_modules',
  '.vscode',
  '.idea',
]);

/** Read SKILL.md frontmatter to extract a sanitized name, if present. */
export async function readSkillFrontmatterName(skillMdPath: string): Promise<string> {
  const content = await readFileSafe(skillMdPath);
  if (!content) return '';
  const { frontmatter } = parseFrontmatter(content);
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
      if (REPO_BOILERPLATE_DIRS.has(first)) return false;
      if (!rel.includes('/') && REPO_BOILERPLATE_FILES.has(rel)) return false;
      return true;
    },
  });
}
