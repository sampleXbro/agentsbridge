import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  ruleToCanonicalEntries,
  toKiroRule,
} from '../../../../src/targets/kiro/permissions-format.js';
import {
  canonicalToKiroRules,
  mergeImportedEntries,
  parseKiroRules,
  unmappedPermissionEntries,
} from '../../../../src/targets/kiro/permissions-lists.js';
import {
  buildKiroPermissionsYaml,
  emitKiroAgentPermissions,
  generateKiroGlobalPermissions,
} from '../../../../src/targets/kiro/permissions-generate.js';
import { generateAgents } from '../../../../src/targets/kiro/generator.js';
import { importFromKiro } from '../../../../src/targets/kiro/importer.js';
import { lintPermissions } from '../../../../src/targets/kiro/lint.js';
import { descriptor } from '../../../../src/targets/kiro/index.js';
import {
  KIRO_AGENTS_DIR,
  KIRO_GLOBAL_PERMISSIONS_FILE,
} from '../../../../src/targets/kiro/constants.js';

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

function agent(name: string): CanonicalFiles['agents'][number] {
  return {
    source: `/proj/.agentsmesh/agents/${name}.md`,
    name,
    description: `${name} agent`,
    tools: ['Read'],
    model: '',
    body: `You are ${name}.`,
  };
}

const PERMS = {
  allow: ['Read', 'Grep', 'Bash(npm run test:*)'],
  deny: ['WebFetch(domain:example.com)', 'Read(./.env)'],
  ask: ['Write'],
};

const ALL_FEATURES = new Set(['agents', 'permissions']);

describe('toKiroRule', () => {
  it('maps a bare canonical tool to a capability with no match list', () => {
    expect(toKiroRule('Read', 'allow')).toEqual({ capability: 'fs_read', effect: 'allow' });
  });

  it('rewrites the canonical `:*` command prefix as a Kiro shell wildcard', () => {
    expect(toKiroRule('Bash(npm run test:*)', 'allow')).toEqual({
      capability: 'shell',
      match: ['npm run test*'],
      effect: 'allow',
    });
  });

  it('passes filesystem globs through verbatim', () => {
    expect(toKiroRule('Read(./src/**)', 'deny')).toEqual({
      capability: 'fs_read',
      match: ['./src/**'],
      effect: 'deny',
    });
  });

  it('drops a payload on a capability whose match list takes no canonical pattern', () => {
    expect(toKiroRule('WebFetch(domain:example.com)', 'allow')).toBeNull();
  });

  it('returns null for an unknown tool, an empty payload and a malformed entry', () => {
    expect(toKiroRule('Nonsense', 'allow')).toBeNull();
    expect(toKiroRule('Bash()', 'allow')).toBeNull();
    expect(toKiroRule('  ', 'allow')).toBeNull();
  });
});

describe('canonicalToKiroRules', () => {
  it('emits deny, then ask, then allow rules and dedupes identical ones', () => {
    expect(
      canonicalToKiroRules({ allow: ['Read', 'Grep'], deny: ['Write'], ask: ['Bash'] }),
    ).toEqual([
      { capability: 'fs_write', effect: 'deny' },
      { capability: 'shell', effect: 'ask' },
      { capability: 'fs_read', effect: 'allow' },
    ]);
  });

  it('returns [] when there are no permissions and when ask is omitted', () => {
    expect(canonicalToKiroRules(null)).toEqual([]);
    expect(canonicalToKiroRules({ allow: [], deny: [] })).toEqual([]);
  });
});

describe('unmappedPermissionEntries', () => {
  it('groups the entries Kiro cannot express by effect', () => {
    expect(unmappedPermissionEntries(PERMS)).toEqual({
      allow: [],
      deny: ['WebFetch(domain:example.com)'],
      ask: [],
    });
  });

  it('returns empty groups for null permissions', () => {
    expect(unmappedPermissionEntries(null)).toEqual({ allow: [], deny: [], ask: [] });
  });
});

describe('parseKiroRules', () => {
  it('accepts a scalar match and normalizes it to a list', () => {
    expect(parseKiroRules([{ capability: 'shell', match: 'npm *', effect: 'allow' }])).toEqual([
      { capability: 'shell', match: ['npm *'], effect: 'allow' },
    ]);
  });

  it('skips rules carrying an exclude list, which canonical cannot represent', () => {
    expect(
      parseKiroRules([
        { capability: 'shell', match: ['npm *'], exclude: ['npm publish*'], effect: 'allow' },
      ]),
    ).toEqual([]);
  });

  it('skips malformed entries and non-array input', () => {
    expect(parseKiroRules('nope')).toEqual([]);
    expect(parseKiroRules([null, 7, {}, { capability: 'shell' }, { effect: 'allow' }])).toEqual([]);
    expect(parseKiroRules([{ capability: 'shell', effect: 'maybe' }])).toEqual([]);
    expect(parseKiroRules([{ capability: 'shell', match: [1, 'ok'], effect: 'allow' }])).toEqual([
      { capability: 'shell', match: ['ok'], effect: 'allow' },
    ]);
  });
});

describe('ruleToCanonicalEntries', () => {
  it('writes a shell wildcard back as the canonical `:*` prefix', () => {
    expect(
      ruleToCanonicalEntries({ capability: 'shell', match: ['npm run test*'], effect: 'allow' }),
    ).toEqual(['Bash(npm run test:*)']);
  });

  it('returns one canonical entry per match pattern', () => {
    expect(
      ruleToCanonicalEntries({ capability: 'fs_write', match: ['*.env', '*.pem'], effect: 'deny' }),
    ).toEqual(['Write(*.env)', 'Write(*.pem)']);
  });

  it('leaves a bare wildcard alone rather than inventing an empty command prefix', () => {
    expect(ruleToCanonicalEntries({ capability: 'shell', match: ['*'], effect: 'allow' })).toEqual([
      'Bash(*)',
    ]);
  });

  it('returns nothing for meta capabilities and for a match on a non-pattern capability', () => {
    expect(ruleToCanonicalEntries({ capability: 'all', effect: 'deny' })).toEqual([]);
    expect(
      ruleToCanonicalEntries({ capability: 'web_fetch', match: ['x'], effect: 'allow' }),
    ).toEqual([]);
  });
});

describe('mergeImportedEntries', () => {
  const readRule = { capability: 'fs_read', effect: 'allow' } as const;

  it('keeps the canonical spelling of an entry that projects to the imported rule', () => {
    expect(mergeImportedEntries(['Grep', 'LS'], [readRule], 'allow')).toEqual(['Grep', 'LS']);
  });

  it('dedupes repeated rules and ignores rules for another effect', () => {
    expect(
      mergeImportedEntries(
        [],
        [readRule, readRule, { capability: 'shell', effect: 'deny' }],
        'allow',
      ),
    ).toEqual(['Read']);
  });

  it('drops a canonical entry Kiro no longer grants but keeps one it cannot express', () => {
    expect(mergeImportedEntries(['Read', 'WebFetch(domain:x)'], [], 'allow')).toEqual([
      'WebFetch(domain:x)',
    ]);
  });
});

describe('buildKiroPermissionsYaml', () => {
  it('writes the rules list under the `rules` key', () => {
    const content = buildKiroPermissionsYaml(PERMS, null)!;
    const parsed = parseYaml(content) as { rules: unknown[] };
    expect(Object.keys(parsed)).toEqual(['rules']);
    expect(parsed.rules).toContainEqual({
      capability: 'shell',
      match: ['npm run test*'],
      effect: 'allow',
    });
  });

  it('leaves the file alone when canonical says nothing and no rules key exists', () => {
    expect(buildKiroPermissionsYaml(null, null)).toBeNull();
    expect(buildKiroPermissionsYaml({ allow: [], deny: [] }, 'other: 1\n')).toBeNull();
  });

  it('clears a previously generated rules list so a revoked grant stops applying', () => {
    const content = buildKiroPermissionsYaml(
      { allow: [], deny: [] },
      'rules:\n  - capability: shell\n    effect: allow\n',
    )!;
    expect(parseYaml(content)).toEqual({ rules: [] });
  });

  it('keeps unrelated top-level keys', () => {
    const kept = buildKiroPermissionsYaml(PERMS, 'version: 2\nrules: []\n')!;
    expect((parseYaml(kept) as { version: number }).version).toBe(2);
  });
});

describe('generateKiroGlobalPermissions (scopeExtras)', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kiro-perms-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('emits the user-scoped permissions.yaml in global scope', async () => {
    const results = await generateKiroGlobalPermissions(
      canonical({ permissions: PERMS }),
      dir,
      'global',
      new Set(['permissions']),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(KIRO_GLOBAL_PERMISSIONS_FILE);
    expect(results[0]!.status).toBe('created');
  });

  it('emits nothing at project scope — Kiro has no in-repo permissions file', async () => {
    expect(
      await generateKiroGlobalPermissions(
        canonical({ permissions: PERMS }),
        dir,
        'project',
        new Set(['permissions']),
      ),
    ).toEqual([]);
  });

  it('emits nothing when the permissions feature is disabled or nothing is to be written', async () => {
    expect(
      await generateKiroGlobalPermissions(
        canonical({ permissions: PERMS }),
        dir,
        'global',
        new Set(['rules']),
      ),
    ).toEqual([]);
    expect(
      await generateKiroGlobalPermissions(canonical(), dir, 'global', new Set(['permissions'])),
    ).toEqual([]);
  });

  it('reports `updated` against the file already on disk', async () => {
    mkdirSync(join(dir, '.kiro/settings'), { recursive: true });
    writeFileSync(join(dir, KIRO_GLOBAL_PERMISSIONS_FILE), 'rules: []\n');
    const results = await generateKiroGlobalPermissions(
      canonical({ permissions: PERMS }),
      dir,
      'global',
      new Set(['permissions']),
    );
    expect(results[0]!.status).toBe('updated');
  });

  it('is wired as the descriptor scopeExtras hook', () => {
    expect(descriptor.globalSupport.scopeExtras).toBe(generateKiroGlobalPermissions);
  });

  it('passes the permissions path through the global rewrite untouched', () => {
    expect(
      descriptor.globalSupport.layout.rewriteGeneratedPath!(KIRO_GLOBAL_PERMISSIONS_FILE),
    ).toBe(KIRO_GLOBAL_PERMISSIONS_FILE);
  });

  it('is detected as a global-mode Kiro artifact', () => {
    expect(descriptor.globalSupport.detectionPaths).toContain(KIRO_GLOBAL_PERMISSIONS_FILE);
  });

  it('stays out of managed outputs so stale cleanup never deletes the user file', () => {
    expect(descriptor.globalSupport.layout.managedOutputs!.files).not.toContain(
      KIRO_GLOBAL_PERMISSIONS_FILE,
    );
    expect(descriptor.globalSupport.layout.managedOutputs!.dirs).not.toContain('.kiro/settings');
  });
});

describe('emitKiroAgentPermissions (project scope, agent profile)', () => {
  const full = canonical({ agents: [agent('code-reviewer')], permissions: PERMS });

  it('folds the rules into every generated agent profile', () => {
    const outputs = emitKiroAgentPermissions(full, 'project', ALL_FEATURES);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.path).toBe(`${KIRO_AGENTS_DIR}/code-reviewer.md`);
    expect(outputs[0]!.content).toContain('permissions:');
    expect(outputs[0]!.content).toContain('capability: fs_read');
  });

  it('emits nothing in global scope, where permissions.yaml is the surface', () => {
    expect(emitKiroAgentPermissions(full, 'global', ALL_FEATURES)).toEqual([]);
  });

  it('emits nothing when either the agents or the permissions feature is disabled', () => {
    expect(emitKiroAgentPermissions(full, 'project', new Set(['permissions']))).toEqual([]);
    expect(emitKiroAgentPermissions(full, 'project', new Set(['agents']))).toEqual([]);
  });

  it('emits nothing when canonical maps to no Kiro rule', () => {
    const noRules = canonical({ agents: [agent('code-reviewer')], permissions: null });
    expect(emitKiroAgentPermissions(noRules, 'project', ALL_FEATURES)).toEqual([]);
  });

  it('is wired as the descriptor emitScopedSettings hook', () => {
    expect(descriptor.emitScopedSettings).toBe(emitKiroAgentPermissions);
  });
});

describe('generateAgents — base profile carries no permissions', () => {
  it('never leaks permissions when only the agents feature runs', () => {
    const outputs = generateAgents(canonical({ agents: [agent('code-reviewer')] }));
    expect(outputs[0]!.content).not.toContain('permissions:');
  });
});

describe('descriptor capabilities — permissions', () => {
  it('declares permissions embedded at project scope and native at global scope', () => {
    expect(descriptor.capabilities.permissions).toBe('embedded');
    expect(descriptor.globalSupport.capabilities.permissions).toBe('native');
  });
});

describe('lintPermissions (kiro)', () => {
  it('names the agent-profile caveat at project scope', () => {
    const diags = lintPermissions(
      canonical({ agents: [agent('code-reviewer')], permissions: { allow: ['Read'], deny: [] } }),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('.kiro/agents/');
  });

  it('drops the agent-profile caveat at global scope', () => {
    expect(
      lintPermissions(canonical({ permissions: { allow: ['Read'], deny: [] } }), {
        scope: 'global',
      }),
    ).toEqual([]);
  });

  it('names every entry Kiro cannot express', () => {
    const diags = lintPermissions(canonical({ permissions: PERMS }), { scope: 'global' });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('WebFetch');
  });
});

describe('importFromKiro — permissions', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kiro-perms-import-'));
    mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function writeGlobalPermissions(body: string): void {
    mkdirSync(join(dir, '.kiro/settings'), { recursive: true });
    writeFileSync(join(dir, KIRO_GLOBAL_PERMISSIONS_FILE), body);
  }

  function writeAgent(name: string, body: string): void {
    mkdirSync(join(dir, KIRO_AGENTS_DIR), { recursive: true });
    writeFileSync(join(dir, `${KIRO_AGENTS_DIR}/${name}.md`), body);
  }

  function readCanonicalPermissions(): Record<string, unknown> {
    return parseYaml(readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
  }

  it('imports the user-scoped permissions.yaml in global scope', async () => {
    writeGlobalPermissions(
      'rules:\n' +
        '  - capability: fs_read\n' +
        '    effect: allow\n' +
        '  - capability: shell\n' +
        "    match: ['npm run test*']\n" +
        '    effect: ask\n' +
        '  - capability: fs_write\n' +
        "    match: ['*.env']\n" +
        '    effect: deny\n',
    );
    const results = await importFromKiro(dir, { scope: 'global' });
    const perm = results.find((r) => r.feature === 'permissions');
    expect(perm!.toPath).toBe('.agentsmesh/permissions.yaml');
    expect(readCanonicalPermissions()).toEqual({
      allow: ['Read'],
      deny: ['Write(*.env)'],
      ask: ['Bash(npm run test:*)'],
    });
  });

  it('keeps canonical spelling and entries Kiro cannot express', async () => {
    writeFileSync(
      join(dir, '.agentsmesh/permissions.yaml'),
      "# hand written\nallow: [Grep, 'WebFetch(domain:x)']\ndeny: []\n",
    );
    writeGlobalPermissions('rules:\n  - capability: fs_read\n    effect: allow\n');
    await importFromKiro(dir, { scope: 'global' });
    const raw = readFileSync(join(dir, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(raw).toContain('# hand written');
    expect(readCanonicalPermissions().allow).toEqual(['Grep', 'WebFetch(domain:x)']);
  });

  it('imports permissions embedded in agent profiles in project scope', async () => {
    writeAgent(
      'code-reviewer',
      '---\nname: code-reviewer\ndescription: r\npermissions:\n  rules:\n' +
        '    - capability: fs_read\n      effect: allow\n---\n\nBody.\n',
    );
    const results = await importFromKiro(dir, { scope: 'project' });
    expect(results.find((r) => r.feature === 'permissions')!.toPath).toBe(
      '.agentsmesh/permissions.yaml',
    );
    expect(readCanonicalPermissions().allow).toEqual(['Read']);
  });

  it('collapses profiles in the safe direction and keeps the canonical agent clean', async () => {
    writeAgent(
      'a',
      '---\nname: a\ndescription: a\npermissions:\n  rules:\n' +
        '    - capability: fs_read\n      effect: allow\n---\n\nA.\n',
    );
    writeAgent(
      'b',
      '---\nname: b\ndescription: b\npermissions:\n  rules:\n' +
        '    - capability: shell\n      effect: deny\n---\n\nB.\n',
    );
    await importFromKiro(dir, { scope: 'project' });
    // `fs_read allow` is only in profile a, so importing it would grant b a
    // read it never had; the shell deny from b is kept for both.
    expect(readCanonicalPermissions()).toEqual({ allow: [], deny: ['Bash'] });
    expect(readFileSync(join(dir, '.agentsmesh/agents/a.md'), 'utf-8')).not.toContain(
      'permissions:',
    );
  });

  it('writes nothing when no profile carries permissions or the file is malformed', async () => {
    writeAgent('plain', '---\nname: plain\ndescription: p\n---\n\nBody.\n');
    writeAgent('odd', '---\nname: odd\ndescription: o\npermissions:\n  rules: nope\n---\n\nO.\n');
    writeAgent('empty', '');
    writeFileSync(join(dir, `${KIRO_AGENTS_DIR}/notes.txt`), 'not a profile');
    writeGlobalPermissions('rules: not-a-list\n');
    const project = await importFromKiro(dir, { scope: 'project' });
    const global = await importFromKiro(dir, { scope: 'global' });
    expect(project.find((r) => r.feature === 'permissions')).toBeUndefined();
    expect(global.find((r) => r.feature === 'permissions')).toBeUndefined();
  });

  it('writes nothing in global scope when there is no permissions.yaml', async () => {
    const results = await importFromKiro(dir, { scope: 'global' });
    expect(results.find((r) => r.feature === 'permissions')).toBeUndefined();
  });

  it('recovers from an empty or non-map canonical permissions file', async () => {
    writeGlobalPermissions('rules:\n  - capability: fs_read\n    effect: allow\n');
    writeFileSync(join(dir, '.agentsmesh/permissions.yaml'), '');
    await importFromKiro(dir, { scope: 'global' });
    expect(readCanonicalPermissions()).toEqual({ allow: ['Read'], deny: [] });

    writeFileSync(join(dir, '.agentsmesh/permissions.yaml'), '- not\n- a map\n');
    await importFromKiro(dir, { scope: 'global' });
    expect(readCanonicalPermissions()).toEqual({ allow: ['Read'], deny: [] });
  });

  it('round-trips generate -> write -> import -> generate as a fixed point', async () => {
    const content = buildKiroPermissionsYaml(PERMS, null)!;
    writeGlobalPermissions(content);
    writeFileSync(
      join(dir, '.agentsmesh/permissions.yaml'),
      `allow: ${JSON.stringify(PERMS.allow)}\ndeny: ${JSON.stringify(PERMS.deny)}\nask: ${JSON.stringify(PERMS.ask)}\n`,
    );
    await importFromKiro(dir, { scope: 'global' });
    const reimported = readCanonicalPermissions();
    expect(buildKiroPermissionsYaml(reimported as never, content)).toBe(content);
  });
});
