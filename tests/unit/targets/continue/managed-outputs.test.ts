import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  cleanupStaleGeneratedOutputs,
  findStaleGeneratedOutputs,
} from '../../../../src/core/generate/stale-cleanup.js';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { CONTINUE_AGENTS_DIR } from '../../../../src/targets/continue/constants.js';

const TEST_DIR = join(tmpdir(), 'am-continue-managed-outputs');

beforeEach(() => mkdirSync(join(TEST_DIR, CONTINUE_AGENTS_DIR), { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

/** A real workspace assistant profile — Continue's own artifact, never written by agentsmesh. */
const USER_PROFILE = [
  'name: my-assistant',
  'version: 1.0.0',
  'schema: v1',
  'models:',
  '  - uses: anthropic/claude-sonnet-4',
  'context:',
  '  - provider: codebase',
  'docs:',
  '  - name: API',
  '    startUrl: https://example.com/docs',
  '',
].join('\n');

describe('continue managed outputs — hand-written agent files survive generate', () => {
  it('never reports a user assistant profile or agent file as stale', async () => {
    writeFileSync(join(TEST_DIR, CONTINUE_AGENTS_DIR, 'my-assistant.yaml'), USER_PROFILE);
    writeFileSync(
      join(TEST_DIR, CONTINUE_AGENTS_DIR, 'handwritten.md'),
      '---\nname: handwritten\n---\nMine.\n',
    );

    const stale = await findStaleGeneratedOutputs({
      projectRoot: TEST_DIR,
      targets: ['continue'],
      expectedPaths: [`${CONTINUE_AGENTS_DIR}/reviewer.md`],
      scope: 'project',
    });

    expect(stale).toEqual([]);
  });

  it('leaves both files on disk after a cleanup pass at either scope', async () => {
    const profile = join(TEST_DIR, CONTINUE_AGENTS_DIR, 'my-assistant.yaml');
    const handwritten = join(TEST_DIR, CONTINUE_AGENTS_DIR, 'handwritten.md');
    writeFileSync(profile, USER_PROFILE);
    writeFileSync(handwritten, '---\nname: handwritten\n---\nMine.\n');

    for (const scope of ['project', 'global'] as const) {
      await cleanupStaleGeneratedOutputs({
        projectRoot: TEST_DIR,
        targets: ['continue'],
        expectedPaths: [`${CONTINUE_AGENTS_DIR}/reviewer.md`],
        scope,
      });
      expect(existsSync(profile)).toBe(true);
      expect(existsSync(handwritten)).toBe(true);
    }
  });

  it('still evicts stale files from the directories agentsmesh fully owns', async () => {
    mkdirSync(join(TEST_DIR, '.continue/rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.continue/rules/dropped.md'), 'old');

    const stale = await findStaleGeneratedOutputs({
      projectRoot: TEST_DIR,
      targets: ['continue'],
      expectedPaths: [],
      scope: 'project',
    });

    expect(stale).toEqual(['.continue/rules/dropped.md']);
  });

  it('declares the exact managed dirs and files per scope', () => {
    expect(getTargetLayout('continue', 'project')!.managedOutputs).toEqual({
      dirs: ['.continue/prompts', '.continue/rules', '.continue/skills'],
      files: ['.continue/mcpServers/agentsmesh.json', '.continueignore'],
    });
    expect(getTargetLayout('continue', 'global')!.managedOutputs).toEqual({
      dirs: ['.continue/rules', '.continue/prompts', '.continue/skills', '.agents/skills'],
      files: [
        '.continue/mcpServers/agentsmesh.json',
        '.continue/AGENTS.md',
        '.continue/config.yaml',
        '.continue/permissions.yaml',
        '.continue/.continueignore',
      ],
    });
  });
});
