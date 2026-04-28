/**
 * Integration tests for cross-target lint guards:
 *   - silent-drop guard: warns when canonical features are dropped by a target
 *   - hook-script reference guard: warns when hook commands reference scripts
 *     that won't be projected into the target tree
 *   - manual-rule scope inversion guard: warns when a manual-only rule would
 *     become always-on for a target without manual activation semantics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function writeBaselineRoot(dir: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\ndescription: "root"\n---\n# Rules\n',
  );
}

function runLint(cwd: string): { combined: string; status: number } {
  const result = spawnSync(process.execPath, [CLI_PATH, 'lint'], { cwd, encoding: 'utf-8' });
  return { combined: `${result.stdout}${result.stderr}`, status: result.status ?? -1 };
}

describe('agentsmesh lint — cross-target guards', () => {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'am-lint-cross-target-'));
  });

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('warns when canonical permissions exist but a configured target has no permissions support (#1418/1420)', () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [cline]\nfeatures: [rules, permissions]\n',
    );
    writeBaselineRoot(dir);
    writeFileSync(
      join(dir, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Read\n  - Bash(pnpm test:*)\ndeny:\n  - Read(./.env)\n',
    );

    const { combined } = runLint(dir);
    expect(combined).toMatch(/cline/);
    expect(combined).toMatch(/permissions/i);
    expect(combined).toMatch(/silently/i);
    expect(combined).toMatch(/warning/i);
  });

  it('warns when canonical hook command references a script for a target that does not project assets (#1317)', () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules, hooks]\n',
    );
    writeBaselineRoot(dir);
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      'sessionStart:\n  - matcher: "*"\n    command: "./scripts/start.sh"\n',
    );

    const { combined } = runLint(dir);
    expect(combined).toMatch(/claude-code/);
    expect(combined).toMatch(/script/i);
    expect(combined).toMatch(/start\.sh/);
    expect(combined).toMatch(/warning/i);
  });

  it('warns when a canonical rule has trigger:manual and is generated for a non-Cursor target (#1515)', () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Rules\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', 'pirate.md'),
      '---\ntrigger: manual\n---\nSpeak like a pirate!\n',
    );

    const { combined } = runLint(dir);
    expect(combined).toMatch(/claude-code/);
    expect(combined).toMatch(/manual/);
    expect(combined).toMatch(/always-on|unconditionally/i);
  });

  it('does not warn when a manual rule is restricted to cursor only', () => {
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\n',
    );
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Rules\n');
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', 'pirate.md'),
      '---\ntrigger: manual\ntargets:\n  - cursor\n---\nSpeak like a pirate!\n',
    );

    const { combined } = runLint(dir);
    expect(combined).not.toMatch(/manual/);
  });
});
