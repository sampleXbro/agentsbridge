import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, GenerateResult, ImportResult } from '../../../../src/core/types.js';
import {
  serializeToolPermissions,
  buildSettingsContent,
} from '../../../../src/targets/augment-code/settings-build.js';
import { importAugmentSettings } from '../../../../src/targets/augment-code/settings-helpers.js';
import { importFromAugmentCode } from '../../../../src/targets/augment-code/importer.js';
import { descriptor } from '../../../../src/targets/augment-code/index.js';
import {
  AUGMENT_CODE_SETTINGS_FILE,
  AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/augment-code/constants.js';

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

const PERMS = { allow: ['view'], deny: ['remove-files'], ask: ['launch-process'] };

const TOOL_PERMISSIONS = [
  { toolName: 'view', permission: { type: 'allow' } },
  { toolName: 'remove-files', permission: { type: 'deny' } },
  { toolName: 'launch-process', permission: { type: 'ask-user' } },
];

const ALL_FEATURES = new Set(['mcp', 'hooks', 'permissions']);

describe('serializeToolPermissions', () => {
  it('maps canonical allow/deny/ask to Augment toolPermissions entries', () => {
    expect(serializeToolPermissions(PERMS)).toEqual(TOOL_PERMISSIONS);
  });

  it('returns undefined when there is nothing to emit', () => {
    expect(serializeToolPermissions(null)).toBeUndefined();
    expect(serializeToolPermissions({ allow: [], deny: [], ask: [] })).toBeUndefined();
  });
});

describe('buildSettingsContent — toolPermissions at both scopes', () => {
  it('includes toolPermissions in project scope', () => {
    const content = buildSettingsContent(
      canonical({ permissions: PERMS }),
      new Set(['permissions']),
    );
    const parsed = JSON.parse(content!) as { toolPermissions?: unknown[] };
    expect(parsed.toolPermissions).toEqual(TOOL_PERMISSIONS);
  });

  it('omits toolPermissions when the permissions feature is disabled', () => {
    expect(buildSettingsContent(canonical({ permissions: PERMS }), new Set(['mcp']))).toBeNull();
  });
});

describe('descriptor capabilities — permissions', () => {
  it('declares permissions native at project scope', () => {
    expect(descriptor.capabilities.permissions).toBe('native');
  });

  it('declares permissions native at global scope', () => {
    expect(descriptor.globalSupport.capabilities.permissions).toBe('native');
  });
});

describe('emitScopedSettings — permissions alongside mcp and hooks', () => {
  const full = canonical({
    permissions: PERMS,
    mcp: { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } },
    hooks: { PreToolUse: [{ matcher: 'launch-process', command: 'scripts/check.sh' }] },
  });

  it('writes mcpServers, hooks and toolPermissions into one project settings file', () => {
    const outputs = descriptor.emitScopedSettings(full, 'project', ALL_FEATURES);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe(AUGMENT_CODE_SETTINGS_FILE);
    expect(Object.keys(JSON.parse(outputs[0]!.content) as object)).toEqual([
      'mcpServers',
      'hooks',
      'toolPermissions',
    ]);
  });

  it('emits toolPermissions at project scope even without mcp or hooks', () => {
    const outputs = descriptor.emitScopedSettings(
      canonical({ permissions: PERMS }),
      'project',
      ALL_FEATURES,
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe(AUGMENT_CODE_SETTINGS_FILE);
    expect(
      (JSON.parse(outputs[0]!.content) as { toolPermissions: unknown }).toolPermissions,
    ).toEqual(TOOL_PERMISSIONS);
  });
});

describe('mergeGeneratedOutputContent — pending write is the merge base', () => {
  function pendingResult(content: string): GenerateResult {
    return {
      target: 'augment-code',
      path: AUGMENT_CODE_SETTINGS_FILE,
      content,
      status: 'created',
    };
  }

  it('keeps keys written earlier in the same run when a later pass adds toolPermissions', () => {
    const pending = pendingResult(
      JSON.stringify({ mcpServers: { context7: { type: 'http', url: 'u' } } }),
    );
    const merged = descriptor.mergeGeneratedOutputContent(
      JSON.stringify({ customKey: true }),
      pending,
      JSON.stringify({ toolPermissions: TOOL_PERMISSIONS }),
      AUGMENT_CODE_SETTINGS_FILE,
    );
    expect(JSON.parse(merged!)).toEqual({
      mcpServers: { context7: { type: 'http', url: 'u' } },
      toolPermissions: TOOL_PERMISSIONS,
    });
  });

  it('falls back to on-disk content when there is no pending write', () => {
    const merged = descriptor.mergeGeneratedOutputContent(
      JSON.stringify({ mcpServers: { context7: { type: 'http', url: 'u' } } }),
      undefined,
      JSON.stringify({ toolPermissions: TOOL_PERMISSIONS }),
      AUGMENT_CODE_GLOBAL_SETTINGS_FILE,
    );
    expect(JSON.parse(merged!)).toEqual({
      mcpServers: { context7: { type: 'http', url: 'u' } },
      toolPermissions: TOOL_PERMISSIONS,
    });
  });
});

describe('importFromAugmentCode — permissions at both scopes', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'augment-perms-'));
    mkdirSync(join(dir, '.augment'), { recursive: true });
    writeFileSync(
      join(dir, '.augment/settings.json'),
      JSON.stringify({ toolPermissions: TOOL_PERMISSIONS }),
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('imports toolPermissions into canonical permissions.yaml', async () => {
    const imported: ImportResult[] = [];
    await importAugmentSettings(dir, '.augment/settings.json', imported);
    const perm = imported.find((r) => r.feature === 'permissions');
    expect(perm).toBeDefined();
    expect(perm!.toPath).toBe('.agentsmesh/permissions.yaml');
    const written = parseYaml(readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8'));
    expect(written).toEqual(PERMS);
  });

  it('imports permissions in project scope', async () => {
    const results = await importFromAugmentCode(dir, { scope: 'project' });
    const perm = results.find((r) => r.feature === 'permissions');
    expect(perm).toBeDefined();
    expect(perm!.toPath).toBe('.agentsmesh/permissions.yaml');
  });

  it('imports permissions in global scope', async () => {
    const results = await importFromAugmentCode(dir, { scope: 'global' });
    expect(results.find((r) => r.feature === 'permissions')).toBeDefined();
  });
});
