import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

describe('generate reference rewriting for windsurf (integration)', () => {
  let testDir = '';

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'am-integration-reference-rewrite-windsurf-'));
  });

  afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  });

  it('rewrites skill directory references for windsurf root artifacts', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [windsurf]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Use [.agentsmesh/skills/post-feature-qa/](.agentsmesh/skills/post-feature-qa/) and [.agentsmesh/skills/post-feature-qa/references/](.agentsmesh/skills/post-feature-qa/references/).
`,
    );
    writeFileSync(join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir });

    expect(readFileSync(join(testDir, 'AGENTS.md'), 'utf-8')).toContain('skills/post-feature-qa/');
  });
});
