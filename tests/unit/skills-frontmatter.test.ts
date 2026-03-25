import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.worktrees',
  '.agentsbridgecache',
  '.cursor',
]);

function collectSkillFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSkillFiles(fullPath));
      continue;
    }

    if (entry === 'SKILL.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function hasFrontmatterName(content: string): boolean {
  if (!content.startsWith('---\n')) {
    return true;
  }

  const lines = content.split('\n');
  const endIndex = lines.indexOf('---', 1);
  if (endIndex === -1) {
    return true;
  }

  const frontmatterLines = lines.slice(1, endIndex);
  return frontmatterLines.some((line) => line.startsWith('name:'));
}

describe('skill frontmatter contract', () => {
  it('requires name field in SKILL.md frontmatter', () => {
    const skillFiles = collectSkillFiles(REPO_ROOT);
    const missingName = skillFiles.filter((path) => {
      const content = readFileSync(path, 'utf8');
      return !hasFrontmatterName(content);
    });

    expect(missingName.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });
});
