import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run-install.js';

const ROOT = join(tmpdir(), 'ab-install-native-target-integration');

describe('install native target subtree (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', '.github', 'instructions'), { recursive: true });
    mkdirSync(join(ROOT, 'project', '.agentsbridge', 'rules'), { recursive: true });

    writeFileSync(
      join(ROOT, 'upstream', '.github', 'instructions', 'review.instructions.md'),
      '---\ndescription: Review instructions\napplyTo: src/**/*.ts\n---\n\nReview TypeScript changes.\n',
    );

    writeFileSync(
      join(ROOT, 'project', 'agentsbridge.yaml'),
      'version: 1\ntargets: [copilot]\nfeatures: [rules]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('installs a copilot native instructions subtree as a pack', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall(
      {
        force: true,
        target: 'copilot',
        path: '.github/instructions',
        name: 'copilot-review',
      },
      [upstream],
      project,
    );

    const packRule = join(
      project,
      '.agentsbridge',
      'packs',
      'copilot-review',
      'rules',
      'review.md',
    );
    expect(existsSync(packRule)).toBe(true);
    expect(readFileSync(packRule, 'utf-8')).toContain('Review TypeScript changes.');

    const generatedRule = join(project, '.github', 'instructions', 'review.instructions.md');
    expect(existsSync(generatedRule)).toBe(true);
    expect(readFileSync(generatedRule, 'utf-8')).toContain('Review TypeScript changes.');
    expect(existsSync(join(upstream, '.agentsbridge'))).toBe(false);
  });
});
