import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanupStaleGeneratedOutputs } from '../../../src/core/generate/stale-cleanup.js';

const TEST_ROOT = join(tmpdir(), 'agentsmesh-stale-cleanup-test');

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('cleanupStaleGeneratedOutputs', () => {
  it('removes stale managed outputs and preserves expected or unrelated files', async () => {
    mkdirSync(join(TEST_ROOT, '.codex', 'instructions'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.agents', 'skills', 'review'), { recursive: true });

    writeFileSync(join(TEST_ROOT, 'AGENTS.md'), 'keep');
    writeFileSync(join(TEST_ROOT, '.codex', 'config.toml'), 'keep');
    writeFileSync(join(TEST_ROOT, '.codex', 'instructions', 'old.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.agents', 'skills', 'review', 'SKILL.md'), 'stale');
    writeFileSync(join(TEST_ROOT, 'README.md'), 'unrelated');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['codex-cli'],
      expectedPaths: ['AGENTS.md', '.codex/config.toml'],
    });

    expect(existsSync(join(TEST_ROOT, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.codex', 'config.toml'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.codex', 'instructions', 'old.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.agents', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, 'README.md'))).toBe(true);
  });

  it('uses global managed outputs for Claude global cleanup', async () => {
    mkdirSync(join(TEST_ROOT, '.claude', 'commands'), { recursive: true });
    writeFileSync(join(TEST_ROOT, '.claude', 'CLAUDE.md'), 'keep');
    writeFileSync(join(TEST_ROOT, '.claude', 'commands', 'old.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.claude.json'), '{}');
    writeFileSync(join(TEST_ROOT, '.mcp.json'), '{}');
    writeFileSync(join(TEST_ROOT, '.claudeignore'), 'node_modules');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['claude-code'],
      expectedPaths: ['.claude/CLAUDE.md'],
      scope: 'global',
    });

    expect(existsSync(join(TEST_ROOT, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.claude', 'commands', 'old.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.claude.json'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.mcp.json'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.claudeignore'))).toBe(false);
  });

  it('uses Antigravity global managed outputs for cleanup', async () => {
    mkdirSync(join(TEST_ROOT, '.gemini', 'antigravity', 'skills', 'review'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.gemini', 'antigravity', 'workflows'), { recursive: true });
    writeFileSync(join(TEST_ROOT, '.gemini', 'antigravity', 'GEMINI.md'), 'keep');
    writeFileSync(
      join(TEST_ROOT, '.gemini', 'antigravity', 'skills', 'review', 'SKILL.md'),
      'stale',
    );
    writeFileSync(join(TEST_ROOT, '.gemini', 'antigravity', 'mcp_config.json'), '{}');
    writeFileSync(join(TEST_ROOT, '.gemini', 'antigravity', 'workflows', 'deploy.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.gemini', 'notes.md'), 'unrelated');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['antigravity'],
      expectedPaths: ['.gemini/antigravity/GEMINI.md'],
      scope: 'global',
    });

    expect(existsSync(join(TEST_ROOT, '.gemini', 'antigravity', 'GEMINI.md'))).toBe(true);
    expect(
      existsSync(join(TEST_ROOT, '.gemini', 'antigravity', 'skills', 'review', 'SKILL.md')),
    ).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.gemini', 'antigravity', 'mcp_config.json'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.gemini', 'antigravity', 'workflows', 'deploy.md'))).toBe(
      false,
    );
    expect(existsSync(join(TEST_ROOT, '.gemini', 'notes.md'))).toBe(true);
  });

  it('uses Cursor global managed outputs for cleanup', async () => {
    mkdirSync(join(TEST_ROOT, '.agentsmesh-exports', 'cursor'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.cursor', 'rules'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.cursor', 'skills', 'review'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.cursor', 'agents'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_ROOT, '.cursor', 'rules', 'general.mdc'), 'keep');
    writeFileSync(join(TEST_ROOT, '.agentsmesh-exports', 'cursor', 'user-rules.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.cursor', 'skills', 'review', 'SKILL.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.cursor', 'agents', 'reviewer.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.cursor', 'commands', 'ship.md'), 'stale');
    writeFileSync(join(TEST_ROOT, '.cursor', 'mcp.json'), '{}');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['cursor'],
      expectedPaths: ['.cursor/rules/general.mdc'],
      scope: 'global',
    });

    expect(existsSync(join(TEST_ROOT, '.cursor', 'rules', 'general.mdc'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.agentsmesh-exports', 'cursor', 'user-rules.md'))).toBe(
      false,
    );
    expect(existsSync(join(TEST_ROOT, '.cursor', 'skills', 'review', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.cursor', 'agents', 'reviewer.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.cursor', 'commands', 'ship.md'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.cursor', 'mcp.json'))).toBe(false);
  });

  it('uses Codex global managed outputs for cleanup', async () => {
    mkdirSync(join(TEST_ROOT, '.codex', 'agents'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.codex', 'rules'), { recursive: true });
    mkdirSync(join(TEST_ROOT, '.agents', 'skills', 'review'), { recursive: true });
    writeFileSync(join(TEST_ROOT, '.codex', 'AGENTS.md'), 'keep');
    writeFileSync(join(TEST_ROOT, '.codex', 'config.toml'), 'keep');
    writeFileSync(join(TEST_ROOT, '.codex', 'agents', 'reviewer.toml'), 'stale');
    writeFileSync(join(TEST_ROOT, '.codex', 'rules', 'old.rules'), 'stale');
    writeFileSync(join(TEST_ROOT, '.agents', 'skills', 'review', 'SKILL.md'), 'stale');

    await cleanupStaleGeneratedOutputs({
      projectRoot: TEST_ROOT,
      targets: ['codex-cli'],
      expectedPaths: ['.codex/AGENTS.md', '.codex/config.toml'],
      scope: 'global',
    });

    expect(existsSync(join(TEST_ROOT, '.codex', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.codex', 'config.toml'))).toBe(true);
    expect(existsSync(join(TEST_ROOT, '.codex', 'agents', 'reviewer.toml'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.codex', 'rules', 'old.rules'))).toBe(false);
    expect(existsSync(join(TEST_ROOT, '.agents', 'skills', 'review', 'SKILL.md'))).toBe(false);
  });
});
