/**
 * Unit tests for agentsmesh diff command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDiff } from '../../../../src/cli/commands/diff.js';
import { appendAgentsmeshRootInstructionParagraph } from '../../../../src/targets/projection/root-instruction-paragraph.js';

const TEST_DIR = join(tmpdir(), 'am-diff-cmd-test');

function setupProject(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
}

beforeEach(() => setupProject());
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runDiff', () => {
  it('shows diff when .claude/CLAUDE.md would be created', async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({}, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('.claude/CLAUDE.md (current)');
    expect(output).toContain('.claude/CLAUDE.md (generated)');
    expect(output).toContain('Use TypeScript');
    expect(output).toMatch(/\d+ files would be created/);
  });

  it('shows diff when file would be updated', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Old content');
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({}, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('# Old content'); // old content in diff
    expect(output).toContain('Use TypeScript'); // new content in diff
    expect(output).toMatch(/updated/);
  });

  it('shows unchanged when files match', async () => {
    // Write exact content that generator would produce; use claude-code only
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.claude', 'CLAUDE.md'),
      appendAgentsmeshRootInstructionParagraph('# Rules\n- Use TypeScript'),
    );

    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({ targets: 'claude-code' }, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('unchanged');
    expect(output).not.toContain('--- .claude/CLAUDE.md'); // no patch when unchanged
  });

  it('respects --targets filter', async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({ targets: 'claude-code' }, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('.claude/CLAUDE.md');
    expect(output).not.toContain('_root.mdc');
  });

  it('shows "No files to generate" when canonical has no rules at all', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({}, TEST_DIR);

    const output = logs.join('');
    expect(output).toContain('No files to generate');
  });

  it('generates contextual rule files even when no root rule', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      `---
description: "Other"
---
# Other
`,
    );
    const logs: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      logs.push(String(chunk));
      return true;
    });

    await runDiff({}, TEST_DIR);

    const output = logs.join('');
    // Non-root rules now generate .claude/rules/*.md and .cursor/rules/*.mdc
    expect(output).toContain('other');
    expect(output).not.toContain('.claude/CLAUDE.md');
  });
});
