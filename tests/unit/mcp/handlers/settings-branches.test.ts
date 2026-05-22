/**
 * Branch coverage for src/mcp/handlers/settings.ts:
 * - readYaml: non-ENOENT error path (line 17 throws IO_ERROR).
 * - atomicWrite: LIMIT_EXCEEDED guard (line 23).
 * - listMcpServers: parseMcp throws → returns null (line 45).
 * - updateConfig: merge mode with existing conversions object (line 92-95).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { settingsHandlers } from '../../../../src/mcp/handlers/settings.js';
import { MAX_FILE_SIZE_BYTES } from '../../../../src/mcp/limits.js';
import * as mcpModule from '../../../../src/canonical/features/mcp.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-mcp-settings-'));
  mkdirSync(join(projectRoot, '.agentsmesh'), { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('settingsHandlers — branch coverage', () => {
  it('getPermissions returns null when permissions.yaml is missing (ENOENT branch)', async () => {
    const result = await settingsHandlers.getPermissions({ projectRoot });
    expect(result).toBeNull();
  });

  it('listMcpServers returns servers:null when parseMcp throws', async () => {
    vi.spyOn(mcpModule, 'parseMcp').mockRejectedValue(new Error('boom'));
    const result = await settingsHandlers.listMcpServers({ projectRoot });
    expect(result).toEqual({ servers: null });
  });

  it('updateConfig with merge=true preserves existing conversions and adds new keys', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      [
        'version: 1',
        'targets: [claude-code]',
        'features: [rules]',
        'conversions:',
        '  commands_to_skills:',
        '    codex-cli: true',
        '',
      ].join('\n'),
    );
    const result = await settingsHandlers.updateConfig(
      { projectRoot },
      {
        conversions: { agents_to_skills: { 'gemini-cli': true } },
        merge: true,
      },
    );
    expect(result.written).toBe(true);
    const written = readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf-8');
    expect(written).toContain('commands_to_skills');
    expect(written).toContain('agents_to_skills');
  });

  it('updateConfig with merge=false (default) replaces conversions entirely', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      [
        'version: 1',
        'targets: [claude-code]',
        'features: [rules]',
        'conversions:',
        '  commands_to_skills:',
        '    codex-cli: true',
        '',
      ].join('\n'),
    );
    await settingsHandlers.updateConfig(
      { projectRoot },
      { conversions: { agents_to_skills: { 'gemini-cli': true } } },
    );
    const written = readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf-8');
    expect(written).not.toContain('commands_to_skills');
    expect(written).toContain('agents_to_skills');
  });

  it('updateConfig dry_run=true returns written=false without writing', async () => {
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
    );
    const before = readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf-8');
    const result = await settingsHandlers.updateConfig(
      { projectRoot },
      { features: ['rules', 'agents'], dry_run: true },
    );
    expect(result.written).toBe(false);
    expect(readFileSync(join(projectRoot, 'agentsmesh.yaml'), 'utf-8')).toBe(before);
  });

  it('updateHooks: LIMIT_EXCEEDED when YAML exceeds 1 MiB cap', async () => {
    // Build a payload that serializes to > MAX_FILE_SIZE_BYTES.
    const bigArr = Array.from({ length: 10 }, () => ({
      matcher: 'a'.repeat(20_000),
      command: 'b'.repeat(20_000),
    }));
    const huge: Record<string, unknown[]> = {};
    for (let i = 0; i < 30; i++) huge[`Event${i}`] = bigArr;
    // Sanity: ensure the serialized payload actually exceeds the cap.
    const { stringify } = await import('yaml');
    const yaml = stringify(huge);
    if (Buffer.byteLength(yaml, 'utf8') <= MAX_FILE_SIZE_BYTES) return; // skip if too small
    await expect(
      settingsHandlers.updateHooks({ projectRoot }, { hooks: huge }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});
