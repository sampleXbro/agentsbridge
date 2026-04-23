import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function makeEnv(homeDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
}

describe('generate reference rewriting (integration, global scope)', () => {
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'am-integration-reference-rewrite-global-'));
  });

  afterEach(() => {
    if (homeDir) rmSync(homeDir, { recursive: true, force: true });
  });

  it('rewrites markdown link destinations to destination-relative paths in global output, while preserving `.agentsmesh/` in prose', () => {
    const meshDir = join(homeDir, '.agentsmesh');
    mkdirSync(join(meshDir, 'rules'), { recursive: true });
    mkdirSync(join(meshDir, 'skills', 'qa', 'references'), { recursive: true });

    writeFileSync(
      join(meshDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, skills]
`,
    );

    writeFileSync(
      join(meshDir, 'rules', '_root.md'),
      `---
root: true
description: Root rule
---
Prose anchor: \`.agentsmesh/skills/qa/\`.\nMarkdown link: [QA](.agentsmesh/skills/qa/).\n`,
    );

    writeFileSync(join(meshDir, 'skills', 'qa', 'SKILL.md'), '# QA\n');
    writeFileSync(join(meshDir, 'skills', 'qa', 'references', 'checklist.md'), '# Checklist\n');

    execSync(`node ${CLI_PATH} generate --global`, {
      cwd: homeDir,
      env: makeEnv(homeDir),
      stdio: 'pipe',
    });

    const out = readFileSync(join(homeDir, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(out).toContain('Prose anchor: `.agentsmesh/skills/qa/`.');
    expect(out).toContain('Markdown link: [QA](./skills/qa/).');
  });
});
