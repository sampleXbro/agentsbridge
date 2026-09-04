/**
 * hasGlobalCursorArtifacts must answer with a boolean on a real filesystem,
 * including when only the skills/agents/commands directories exist.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasGlobalCursorArtifacts } from '../../../../src/targets/cursor/import-global-exports-helpers.js';
import {
  CURSOR_AGENTS_DIR,
  CURSOR_COMMANDS_DIR,
  CURSOR_SKILLS_DIR,
} from '../../../../src/targets/cursor/constants.js';

const roots: string[] = [];

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'am-'));
  roots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content, 'utf-8');
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe('hasGlobalCursorArtifacts (real filesystem)', () => {
  it('is true when only the agents directory holds a markdown file', async () => {
    const root = await project({ [`${CURSOR_AGENTS_DIR}/a.md`]: '# agent' });
    await expect(hasGlobalCursorArtifacts(root)).resolves.toBe(true);
  });

  it('is true when only the commands directory holds a markdown file', async () => {
    const root = await project({ [`${CURSOR_COMMANDS_DIR}/c.md`]: '# command' });
    await expect(hasGlobalCursorArtifacts(root)).resolves.toBe(true);
  });

  it('is true when only a skill folder holds SKILL.md', async () => {
    const root = await project({
      [`${CURSOR_SKILLS_DIR}/my-skill/SKILL.md`]: '---\nname: my-skill\n---\n',
    });
    await expect(hasGlobalCursorArtifacts(root)).resolves.toBe(true);
  });

  it('is false when all three directories exist but hold no markdown', async () => {
    const root = await project({
      [`${CURSOR_SKILLS_DIR}/notes.txt`]: 'x',
      [`${CURSOR_AGENTS_DIR}/notes.txt`]: 'x',
      [`${CURSOR_COMMANDS_DIR}/notes.txt`]: 'x',
    });
    await expect(hasGlobalCursorArtifacts(root)).resolves.toBe(false);
  });

  it('is false for an empty project', async () => {
    const root = await project({});
    await expect(hasGlobalCursorArtifacts(root)).resolves.toBe(false);
  });
});
