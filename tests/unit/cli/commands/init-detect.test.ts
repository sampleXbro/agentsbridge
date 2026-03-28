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
});
