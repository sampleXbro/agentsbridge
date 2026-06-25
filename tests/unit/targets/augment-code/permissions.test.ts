import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';
import {
  serializeToolPermissions,
  buildSettingsContent,
} from '../../../../src/targets/augment-code/settings-build.js';
import { importAugmentSettings } from '../../../../src/targets/augment-code/settings-helpers.js';
import { importFromAugmentCode } from '../../../../src/targets/augment-code/importer.js';

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

describe('serializeToolPermissions', () => {
  it('maps canonical allow/deny/ask to Augment toolPermissions entries', () => {
    expect(serializeToolPermissions(PERMS)).toEqual([
      { toolName: 'view', permission: { type: 'allow' } },
      { toolName: 'remove-files', permission: { type: 'deny' } },
      { toolName: 'launch-process', permission: { type: 'ask-user' } },
    ]);
  });

  it('returns undefined when there is nothing to emit', () => {
    expect(serializeToolPermissions(null)).toBeUndefined();
    expect(serializeToolPermissions({ allow: [], deny: [], ask: [] })).toBeUndefined();
  });
});

describe('buildSettingsContent — toolPermissions is global-only', () => {
  it('includes toolPermissions in global scope', () => {
    const content = buildSettingsContent(
      canonical({ permissions: PERMS }),
      new Set(['permissions']),
      'global',
    );
    const parsed = JSON.parse(content!) as { toolPermissions?: unknown[] };
    expect(parsed.toolPermissions).toEqual([
      { toolName: 'view', permission: { type: 'allow' } },
      { toolName: 'remove-files', permission: { type: 'deny' } },
      { toolName: 'launch-process', permission: { type: 'ask-user' } },
    ]);
  });

  it('omits toolPermissions in project scope', () => {
    const content = buildSettingsContent(
      canonical({ permissions: PERMS }),
      new Set(['permissions']),
      'project',
    );
    // No mcp/hooks/permissions emitted at project scope → null
    expect(content).toBeNull();
  });
});

describe('importFromAugmentCode — permissions (global only)', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'augment-perms-'));
    mkdirSync(join(dir, '.augment'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('imports toolPermissions from the global settings.json into canonical permissions.yaml', async () => {
    writeFileSync(
      join(dir, '.augment/settings.json'),
      JSON.stringify({
        toolPermissions: [
          { toolName: 'view', permission: { type: 'allow' } },
          { toolName: 'remove-files', permission: { type: 'deny' } },
          { toolName: 'launch-process', permission: { type: 'ask-user' } },
        ],
      }),
    );
    const imported: ImportResult[] = [];
    await importAugmentSettings(dir, '.augment/settings.json', imported, {
      includePermissions: true,
    });
    const perm = imported.find((r) => r.feature === 'permissions');
    expect(perm).toBeDefined();
    expect(perm!.toPath).toBe('.agentsmesh/permissions.yaml');
    const written = parseYaml(readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8'));
    expect(written).toEqual(PERMS);
  });

  it('does not import permissions in project scope', async () => {
    writeFileSync(
      join(dir, '.augment/settings.json'),
      JSON.stringify({ toolPermissions: [{ toolName: 'view', permission: { type: 'allow' } }] }),
    );
    const results = await importFromAugmentCode(dir, { scope: 'project' });
    expect(results.find((r) => r.feature === 'permissions')).toBeUndefined();
  });
});
