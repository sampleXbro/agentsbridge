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
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('runDiff', () => {
  it('returns structured data when .claude/CLAUDE.md would be created', async () => {
    const result = await runDiff({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.summary.created).toBeGreaterThan(0);
    expect(result.data.files.length).toBeGreaterThan(0);
    expect(result.data.patches.length).toBeGreaterThan(0);

    const claudeFile = result.data.files.find((f) => f.path.includes('.claude/CLAUDE.md'));
    expect(claudeFile).toBeDefined();
    expect(claudeFile!.status).toBe('created');

    const claudePatch = result.data.patches.find((p) => p.path.includes('.claude/CLAUDE.md'));
    expect(claudePatch).toBeDefined();
    expect(claudePatch!.patch).toContain('Use TypeScript');
  });

  it('returns updated status when file would be updated', async () => {
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Old content');

    const result = await runDiff({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    const claudeFile = result.data.files.find((f) => f.path.includes('.claude/CLAUDE.md'));
    expect(claudeFile).toBeDefined();
    expect(claudeFile!.status).toBe('updated');

    const claudePatch = result.data.patches.find((p) => p.path.includes('.claude/CLAUDE.md'));
    expect(claudePatch).toBeDefined();
    expect(claudePatch!.patch).toContain('# Old content');
    expect(claudePatch!.patch).toContain('Use TypeScript');
  });

  it('returns empty data when files match', async () => {
    // Write exact content that generator would produce; use claude-code only
    mkdirSync(join(TEST_DIR, '.claude'), { recursive: true });
    const onDisk = appendAgentsmeshRootInstructionParagraph('# Rules\n- Use TypeScript');
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), onDisk);

    const result = await runDiff({ targets: 'claude-code' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.files.length).toBe(0);
    expect(result.data.patches.length).toBe(0);
    expect(result.data.summary.created).toBe(0);
    expect(result.data.summary.updated).toBe(0);
    expect(result.data.summary.unchanged).toBeGreaterThan(0);
  });

  it('respects --targets filter', async () => {
    const result = await runDiff({ targets: 'claude-code' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    const paths = result.data.files.map((f) => f.path);
    expect(paths.some((p) => p.includes('.claude/CLAUDE.md'))).toBe(true);
    expect(paths.some((p) => p.includes('_root.mdc'))).toBe(false);
  });

  it('returns empty data when canonical has no rules at all', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));

    const result = await runDiff({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.files).toEqual([]);
    expect(result.data.patches).toEqual([]);
    expect(result.data.summary).toEqual({ created: 0, updated: 0, unchanged: 0, deleted: 0 });
  });

  it('returns contextual rule files even when no root rule', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
      `---
description: "Other"
---
# Other
`,
    );

    const result = await runDiff({}, TEST_DIR);

    expect(result.exitCode).toBe(0);
    const paths = result.data.files.map((f) => f.path);
    expect(paths.some((p) => p.includes('other'))).toBe(true);
    expect(paths.some((p) => p.includes('.claude/CLAUDE.md'))).toBe(false);
  });

  it('diffs Claude global outputs from ~/.agentsmesh when --global is set', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);
    const workspace = `${TEST_DIR}-workspace`;
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(workspace, { recursive: true });

    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Global rules"
---
# Global Rules
`,
    );

    const result = await runDiff({ global: true }, workspace);

    expect(result.exitCode).toBe(0);
    expect(result.data.files.length).toBeGreaterThan(0);

    const claudeFile = result.data.files.find((f) => f.path.includes('.claude/CLAUDE.md'));
    expect(claudeFile).toBeDefined();
    expect(claudeFile!.status).toBe('created');

    const claudePatch = result.data.patches.find((p) => p.path.includes('.claude/CLAUDE.md'));
    expect(claudePatch).toBeDefined();
    expect(claudePatch!.patch).toContain('Global Rules');
  });
});
