import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import {
  buildDefaultTools,
  defaultToolsToCanonicalAllow,
  mergePiSettings,
  unmappedPermissionEntries,
} from '../../../../src/targets/pi-agent/permissions-format.js';
import { generatePermissions } from '../../../../src/targets/pi-agent/generator.js';
import { importFromPiAgent } from '../../../../src/targets/pi-agent/importer.js';
import { lintPermissions } from '../../../../src/targets/pi-agent/lint.js';
import { descriptor } from '../../../../src/targets/pi-agent/index.js';
import {
  PI_AGENT_SETTINGS_FILE,
  PI_AGENT_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/pi-agent/constants.js';

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

const PERMS = {
  allow: ['Read', 'Grep', 'LS', 'Bash(npm run test:*)'],
  deny: ['WebFetch', 'Bash(curl:*)'],
  ask: ['Write'],
};

describe('buildDefaultTools', () => {
  it('maps bare canonical tool names onto Pi built-ins in built-in order', () => {
    expect(buildDefaultTools({ allow: ['LS', 'Glob', 'Grep', 'Read', 'Read'], deny: [] })).toEqual([
      'read',
      'grep',
      'find',
      'ls',
    ]);
  });

  it('ignores parameterized entries — Pi has no per-command or per-path matching', () => {
    expect(
      buildDefaultTools({ allow: ['Bash(npm run test:*)', 'Read(./src/**)'], deny: [] }),
    ).toEqual([]);
  });

  it('ignores deny and ask, which Pi cannot express', () => {
    expect(buildDefaultTools({ allow: [], deny: ['Read'], ask: ['Bash'] })).toEqual([]);
  });

  it('returns [] for null permissions and for tools with no Pi built-in', () => {
    expect(buildDefaultTools(null)).toEqual([]);
    expect(buildDefaultTools({ allow: ['WebFetch'], deny: [] })).toEqual([]);
  });
});

describe('unmappedPermissionEntries (pi-agent)', () => {
  it('names every entry with no Pi built-in, grouped by list', () => {
    expect(unmappedPermissionEntries(PERMS)).toEqual({
      allow: ['Bash(npm run test:*)'],
      deny: ['WebFetch', 'Bash(curl:*)'],
      ask: ['Write'],
    });
  });

  it('returns empty groups for null permissions', () => {
    expect(unmappedPermissionEntries(null)).toEqual({ allow: [], deny: [], ask: [] });
  });
});

describe('generatePermissions (pi-agent)', () => {
  it('writes only the defaultTools key at the project settings path', () => {
    const outputs = generatePermissions(canonical({ permissions: PERMS }));
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe(PI_AGENT_SETTINGS_FILE);
    expect(JSON.parse(outputs[0]!.content)).toEqual({ defaultTools: ['read', 'grep', 'ls'] });
  });

  it('writes an explicit empty list when canonical maps to no built-in', () => {
    const outputs = generatePermissions(canonical({ permissions: { allow: [], deny: ['Read'] } }));
    expect(JSON.parse(outputs[0]!.content)).toEqual({ defaultTools: [] });
  });

  it('emits nothing when there is no canonical permissions file', () => {
    expect(generatePermissions(canonical())).toEqual([]);
  });

  it('rewrites the project path to the global settings file in global scope', () => {
    expect(descriptor.globalSupport.layout.rewriteGeneratedPath!(PI_AGENT_SETTINGS_FILE)).toBe(
      PI_AGENT_GLOBAL_SETTINGS_FILE,
    );
  });

  it('keeps settings.json out of managed outputs so stale cleanup never deletes it', () => {
    expect(descriptor.project.managedOutputs!.files).not.toContain(PI_AGENT_SETTINGS_FILE);
    expect(descriptor.globalSupport.layout.managedOutputs!.files).not.toContain(
      PI_AGENT_GLOBAL_SETTINGS_FILE,
    );
  });
});

describe('mergePiSettings — key-scoped merge into a 48-key settings file', () => {
  const OTHER_KEYS = { defaultModel: 'x', theme: 'dark', sessionDir: '~/s' };

  it('keeps every unrelated key and replaces only defaultTools', () => {
    const merged = mergePiSettings(
      JSON.stringify({ ...OTHER_KEYS, defaultTools: ['read', 'write'] }),
      JSON.stringify({ defaultTools: ['read'] }),
    );
    expect(JSON.parse(merged)).toEqual({ ...OTHER_KEYS, defaultTools: ['read'] });
  });

  it('preserves built-ins agentsmesh does not own, such as powershell', () => {
    const merged = mergePiSettings(
      JSON.stringify({ defaultTools: ['powershell', 'write'] }),
      JSON.stringify({ defaultTools: ['read'] }),
    );
    expect(JSON.parse(merged)).toEqual({ defaultTools: ['read', 'powershell'] });
  });

  it('removes the key when the owned projection empties instead of disabling every tool', () => {
    const merged = mergePiSettings(JSON.stringify({ ...OTHER_KEYS, defaultTools: ['read'] }), '{}');
    expect(JSON.parse(merged)).toEqual(OTHER_KEYS);
  });

  it('creates the file from the overlay when nothing is on disk', () => {
    expect(JSON.parse(mergePiSettings(null, JSON.stringify({ defaultTools: ['read'] })))).toEqual({
      defaultTools: ['read'],
    });
    expect(JSON.parse(mergePiSettings(null, '{}'))).toEqual({});
  });

  it('leaves an unparsable settings file untouched rather than clobbering it', () => {
    expect(mergePiSettings('{ broken', JSON.stringify({ defaultTools: ['read'] }))).toBe(
      '{ broken',
    );
    expect(mergePiSettings('[1,2]', JSON.stringify({ defaultTools: ['read'] }))).toBe('[1,2]');
  });

  it('treats an unparsable or non-array overlay as an empty projection', () => {
    expect(JSON.parse(mergePiSettings(JSON.stringify({ defaultTools: ['read'] }), 'nope'))).toEqual(
      {},
    );
    expect(
      JSON.parse(
        mergePiSettings(
          JSON.stringify({ defaultTools: ['read', 'powershell'] }),
          JSON.stringify({ defaultTools: 'read' }),
        ),
      ),
    ).toEqual({ defaultTools: ['powershell'] });
  });
});

describe('descriptor.mergeGeneratedOutputContent (pi-agent)', () => {
  function pending(content: string): GenerateResult {
    return { target: 'pi-agent', path: PI_AGENT_SETTINGS_FILE, content, status: 'created' };
  }

  it('merges into both the project and the global settings path', () => {
    const merged = descriptor.mergeGeneratedOutputContent!(
      JSON.stringify({ theme: 'dark' }),
      undefined,
      JSON.stringify({ defaultTools: ['read'] }),
      PI_AGENT_GLOBAL_SETTINGS_FILE,
    );
    expect(JSON.parse(merged!)).toEqual({ theme: 'dark', defaultTools: ['read'] });
  });

  it('builds on the pending write from an earlier pass of the same run', () => {
    const merged = descriptor.mergeGeneratedOutputContent!(
      JSON.stringify({ theme: 'dark' }),
      pending(JSON.stringify({ theme: 'dark', defaultTools: ['write'] })),
      JSON.stringify({ defaultTools: ['read'] }),
      PI_AGENT_SETTINGS_FILE,
    );
    expect(JSON.parse(merged!)).toEqual({ theme: 'dark', defaultTools: ['read'] });
  });

  it('returns null for any other generated path', () => {
    expect(descriptor.mergeGeneratedOutputContent!(null, undefined, 'x', 'AGENTS.md')).toBeNull();
  });
});

describe('descriptor capabilities — permissions', () => {
  it('declares permissions native at both scopes', () => {
    expect(descriptor.capabilities.permissions).toBe('native');
    expect(descriptor.globalSupport.capabilities.permissions).toBe('native');
  });
});

describe('defaultToolsToCanonicalAllow', () => {
  it('maps Pi built-ins back to canonical tool names and skips unknown ones', () => {
    expect(defaultToolsToCanonicalAllow(['find', 'read', 'powershell', 'nope'])).toEqual([
      'Glob',
      'Read',
    ]);
  });
});

describe('lintPermissions (pi-agent) — names what is dropped', () => {
  it('names unmapped allow entries, deny entries and ask entries separately', () => {
    const diags = lintPermissions(canonical({ permissions: PERMS }));
    const messages = diags.map((d) => d.message).join('\n');
    expect(diags).toHaveLength(4);
    expect(messages).toContain('Bash(npm run test:*)');
    expect(messages).toContain('Bash(curl:*)');
    expect(messages).toContain('Write');
    expect(messages).toContain('powershell');
  });

  it('warns which built-ins the generated allow-list leaves disabled', () => {
    const diags = lintPermissions(canonical({ permissions: { allow: ['Read'], deny: [] } }));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('bash');
  });
});

describe('importFromPiAgent — permissions', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pi-perms-'));
    mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function writeSettings(rel: string, value: unknown): void {
    mkdirSync(join(dir, rel.slice(0, rel.lastIndexOf('/'))), { recursive: true });
    writeFileSync(join(dir, rel), JSON.stringify(value, null, 2));
  }

  function readCanonicalPermissions(): Record<string, unknown> {
    return parseYaml(readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
  }

  it('imports defaultTools from the project settings file', async () => {
    writeSettings(PI_AGENT_SETTINGS_FILE, { theme: 'dark', defaultTools: ['read', 'grep'] });
    const results = await importFromPiAgent(dir, { scope: 'project' });
    expect(results.find((r) => r.feature === 'permissions')!.toPath).toBe(
      '.agentsmesh/permissions.yaml',
    );
    expect(readCanonicalPermissions()).toEqual({ allow: ['Read', 'Grep'], deny: [] });
  });

  it('imports defaultTools from the global settings file', async () => {
    writeSettings(PI_AGENT_GLOBAL_SETTINGS_FILE, { defaultTools: ['ls'] });
    const results = await importFromPiAgent(dir, { scope: 'global' });
    expect(results.find((r) => r.feature === 'permissions')).toBeDefined();
    expect(readCanonicalPermissions().allow).toEqual(['LS']);
  });

  it('keeps canonical deny, ask, comments and entries Pi cannot express', async () => {
    writeFileSync(
      join(dir, '.agentsmesh/permissions.yaml'),
      "# hand written\nallow: [Write, 'Bash(npm run test:*)']\ndeny: [WebFetch]\nask: [Read]\n",
    );
    writeSettings(PI_AGENT_SETTINGS_FILE, { defaultTools: ['read'] });
    await importFromPiAgent(dir, { scope: 'project' });
    const raw = readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(raw).toContain('# hand written');
    expect(readCanonicalPermissions()).toEqual({
      allow: ['Read', 'Bash(npm run test:*)'],
      deny: ['WebFetch'],
      ask: ['Read'],
    });
  });

  it('writes nothing when the file is absent, unparsable or has no defaultTools array', async () => {
    expect((await importFromPiAgent(dir, { scope: 'project' })).length).toBe(0);
    writeSettings(PI_AGENT_SETTINGS_FILE, { theme: 'dark' });
    expect(
      (await importFromPiAgent(dir, { scope: 'project' })).find((r) => r.feature === 'permissions'),
    ).toBeUndefined();
    writeFileSync(join(dir, PI_AGENT_SETTINGS_FILE), '{ broken');
    expect(
      (await importFromPiAgent(dir, { scope: 'project' })).find((r) => r.feature === 'permissions'),
    ).toBeUndefined();
  });

  it('recovers from an empty or non-map canonical permissions file', async () => {
    writeSettings(PI_AGENT_SETTINGS_FILE, { defaultTools: ['read'] });
    writeFileSync(join(dir, '.agentsmesh/permissions.yaml'), '');
    await importFromPiAgent(dir, { scope: 'project' });
    expect(readCanonicalPermissions()).toEqual({ allow: ['Read'], deny: [] });

    writeFileSync(join(dir, '.agentsmesh/permissions.yaml'), '- not\n- a map\n');
    await importFromPiAgent(dir, { scope: 'project' });
    expect(readCanonicalPermissions()).toEqual({ allow: ['Read'], deny: [] });
  });

  it('round-trips generate -> write -> import -> generate as a fixed point', async () => {
    const generated = generatePermissions(canonical({ permissions: PERMS }))[0]!;
    writeFileSync(
      join(dir, '.agentsmesh/permissions.yaml'),
      `allow: ${JSON.stringify(PERMS.allow)}\ndeny: ${JSON.stringify(PERMS.deny)}\nask: ${JSON.stringify(PERMS.ask)}\n`,
    );
    mkdirSync(join(dir, '.pi'), { recursive: true });
    writeFileSync(join(dir, PI_AGENT_SETTINGS_FILE), generated.content);
    await importFromPiAgent(dir, { scope: 'project' });
    const reimported = readCanonicalPermissions() as unknown as typeof PERMS;
    expect(generatePermissions(canonical({ permissions: reimported }))[0]!.content).toBe(
      generated.content,
    );
  });
});
