import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';
import {
  TOOL_INDICATORS,
  detectExistingConfigs,
} from '../../../../src/cli/commands/init-detect.js';

describe('TOOL_INDICATORS', () => {
  it('has an entry for every target in TARGET_IDS', () => {
    const indicatorIds = TOOL_INDICATORS.map((t) => t.id);
    for (const id of TARGET_IDS) {
      expect(indicatorIds).toContain(id);
    }
  });

  it('ids match TARGET_IDS exactly (same set, no extras)', () => {
    const indicatorIds = TOOL_INDICATORS.map((t) => t.id).sort();
    expect(indicatorIds).toStrictEqual([...TARGET_IDS].sort());
  });

  it('each entry has a non-empty paths array', () => {
    for (const { id, paths } of TOOL_INDICATORS) {
      expect(paths.length, `${id} must have at least one detection path`).toBeGreaterThan(0);
    }
  });
});

describe('detectExistingConfigs', () => {
  it('returns an empty array for an empty directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    expect(await detectExistingConfigs(dir)).toStrictEqual([]);
  });

  it('detects claude-code when CLAUDE.md exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await writeFile(join(dir, 'CLAUDE.md'), '');
    const result = await detectExistingConfigs(dir);
    expect(result).toContain('claude-code');
  });

  it('deduplicates results when multiple paths match the same target', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    // claude-code has multiple detection paths: CLAUDE.md, .claude/rules, .claude/commands
    await writeFile(join(dir, 'CLAUDE.md'), '');
    await mkdir(join(dir, '.claude', 'rules'), { recursive: true });
    const result = await detectExistingConfigs(dir);
    const claudeCodeMatches = result.filter((id) => id === 'claude-code');
    expect(claudeCodeMatches).toHaveLength(1);
  });

  it('detects Antigravity and Codex from global home paths when scope is global', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await mkdir(join(dir, '.gemini', 'antigravity', 'skills'), { recursive: true });
    await mkdir(join(dir, '.codex', 'agents'), { recursive: true });
    await writeFile(join(dir, '.gemini', 'antigravity', 'GEMINI.md'), '');
    await writeFile(join(dir, '.codex', 'AGENTS.md'), '');

    const result = await detectExistingConfigs(dir, 'global');
    expect(result).toContain('antigravity');
    expect(result).toContain('codex-cli');
  });

  it('does not infer Cursor global config when ~/.cursor/rules has no general.mdc', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await mkdir(join(dir, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      join(dir, '.cursor', 'rules', 'typescript.mdc'),
      '---\nalwaysApply: false\n---\n',
    );

    const result = await detectExistingConfigs(dir, 'global');
    expect(result).not.toContain('cursor');
  });

  it('detects Cursor from ~/.cursor/mcp.json when scope is global', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await mkdir(join(dir, '.cursor'), { recursive: true });
    await writeFile(join(dir, '.cursor', 'mcp.json'), '{}');

    const result = await detectExistingConfigs(dir, 'global');
    expect(result).toContain('cursor');
  });

  it('detects Cursor from library global export path when scope is global', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await mkdir(join(dir, '.agentsmesh-exports', 'cursor'), { recursive: true });
    await writeFile(join(dir, '.agentsmesh-exports', 'cursor', 'user-rules.md'), '# U\n');

    const result = await detectExistingConfigs(dir, 'global');
    expect(result).toContain('cursor');
  });

  it('detects Cursor from ~/.cursor/rules/general.mdc when scope is global', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsmesh-test-'));
    await mkdir(join(dir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(dir, '.cursor', 'rules', 'general.mdc'), '---\nalwaysApply: true\n---\n');

    const result = await detectExistingConfigs(dir, 'global');
    expect(result).toContain('cursor');
  });
});
