/**
 * Tests for canonical extends (loadCanonicalWithExtends, filterCanonicalByFeatures).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  filterCanonicalByFeatures,
  loadCanonicalWithExtends,
} from '../../../src/canonical/extends.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

const mockDetect = vi.hoisted(() => vi.fn<[string], Promise<string | null>>());
const mockImportNative = vi.hoisted(() =>
  vi.fn<[string, string], Promise<[]>>().mockResolvedValue([]),
);

vi.mock('../../../src/config/native-format-detector.js', () => ({
  detectNativeFormat: mockDetect,
  KNOWN_NATIVE_PATHS: ['CLAUDE.md', '.claude/'],
}));
vi.mock('../../../src/canonical/native-extends-importer.js', () => ({
  importNativeToCanonical: mockImportNative,
}));

const TEST_DIR = join(tmpdir(), 'agentsbridge-extends-test');

function minimalCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

describe('filterCanonicalByFeatures', () => {
  it('returns empty when features is empty', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
    });
    const result = filterCanonicalByFeatures(c, []);
    expect(result.rules).toEqual([]);
    expect(result.commands).toEqual([]);
  });

  it('filters rules when features includes rules', () => {
    const r = {
      source: '/a/_root.md',
      root: true,
      targets: [],
      description: '',
      globs: [],
      body: 'x',
    };
    const c = minimalCanonical({ rules: [r] });
    const result = filterCanonicalByFeatures(c, ['rules']);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual(r);
  });

  it('excludes rules when features omits rules', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
    });
    const result = filterCanonicalByFeatures(c, ['commands']);
    expect(result.rules).toEqual([]);
  });

  it('ignores unknown feature names (FEATURE_TO_KEYS[f] ?? [])', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
    });
    const result = filterCanonicalByFeatures(c, ['rules', 'unknownFeature']);
    expect(result.rules).toHaveLength(1);
    expect(result.commands).toEqual([]);
  });

  it('filters multiple features', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
      commands: [{ source: 'y', name: 'cmd', description: '', allowedTools: [], body: '' }],
    });
    const result = filterCanonicalByFeatures(c, ['rules', 'commands']);
    expect(result.rules).toHaveLength(1);
    expect(result.commands).toHaveLength(1);
  });

  it('ignores unknown feature names (FEATURE_TO_KEYS fallback)', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
    });
    const result = filterCanonicalByFeatures(c, ['rules', 'unknownFeature']);
    expect(result.rules).toHaveLength(1);
  });

  it('returns agents/skills/mcp/permissions/hooks/ignore when all are in features (true branches)', () => {
    const c = minimalCanonical({
      agents: [
        {
          source: 'a',
          name: 'a',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: '',
        },
      ],
      skills: [{ source: 's', name: 's', description: '', body: 's', supportingFiles: [] }],
      mcp: { mcpServers: { test: { type: 'stdio', command: 'echo', args: [], env: {} } } },
      permissions: { allow: ['Read'], deny: [] },
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'prettier', type: 'command' as const }] },
      ignore: ['node_modules'],
      commands: [{ source: 'c', name: 'c', description: '', allowedTools: [], body: 'c' }],
    });
    const result = filterCanonicalByFeatures(c, [
      'agents',
      'skills',
      'mcp',
      'permissions',
      'hooks',
      'ignore',
      'commands',
    ]);
    expect(result.agents).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.mcp).not.toBeNull();
    expect(result.permissions).not.toBeNull();
    expect(result.hooks).not.toBeNull();
    expect(result.ignore).toHaveLength(1);
    expect(result.commands).toHaveLength(1);
    expect(result.rules).toEqual([]);
  });

  it('returns null for mcp/permissions/hooks when those features are filtered out', () => {
    const c = minimalCanonical({
      rules: [{ source: 'x', root: true, targets: [], description: '', globs: [], body: 'x' }],
      mcp: { mcpServers: { test: { type: 'stdio', command: 'echo', args: [], env: {} } } },
      permissions: { allow: ['Read'], deny: [] },
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'prettier', type: 'command' as const }] },
      ignore: ['node_modules'],
      agents: [
        {
          source: 'a',
          name: 'a',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: '',
        },
      ],
      skills: [{ source: 's', name: 's', description: '', body: 's', supportingFiles: [] }],
      commands: [{ source: 'c', name: 'c', description: '', allowedTools: [], body: 'c' }],
    });
    const result = filterCanonicalByFeatures(c, ['rules']);
    expect(result.rules).toHaveLength(1);
    expect(result.commands).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.mcp).toBeNull();
    expect(result.permissions).toBeNull();
    expect(result.hooks).toBeNull();
    expect(result.ignore).toEqual([]);
  });
});

describe('loadCanonicalWithExtends', () => {
  const PROJECT_DIR = join(TEST_DIR, 'project');
  const SHARED_DIR = join(TEST_DIR, 'shared');

  beforeEach(() => {
    mockDetect.mockReset();
    mockImportNative.mockReset();
    mkdirSync(PROJECT_DIR, { recursive: true });
    mkdirSync(SHARED_DIR, { recursive: true });
    writeFileSync(
      join(PROJECT_DIR, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends: []
`,
    );
    mkdirSync(join(PROJECT_DIR, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(PROJECT_DIR, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
---
# Local root`,
    );
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('returns local only when no extends', async () => {
    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };
    const { canonical, resolvedExtends } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(resolvedExtends).toHaveLength(0);
    expect(canonical.rules).toHaveLength(1);
    expect(canonical.rules[0]?.body).toContain('Local root');
  });

  it('merges extend then local when extend configured', async () => {
    mkdirSync(join(SHARED_DIR, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(SHARED_DIR, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
---
# Shared root`,
    );
    writeFileSync(
      join(SHARED_DIR, '.agentsbridge', 'rules', 'shared.md'),
      `---
description: shared
---
# Shared rule`,
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [
        {
          name: 'base',
          source: join('..', 'shared'),
          features: ['rules'],
        },
      ],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };
    const { canonical, resolvedExtends } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(resolvedExtends).toHaveLength(1);
    expect(resolvedExtends[0]?.name).toBe('base');
    expect(canonical.rules).toHaveLength(2);
    const rootRule = canonical.rules.find((r) => r.root);
    expect(rootRule?.body).toContain('Local root');
    expect(canonical.rules.some((r) => r.body.includes('Shared rule'))).toBe(true);
  });

  it('throws when extend path does not exist', async () => {
    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'missing', source: './does-not-exist', features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };
    await expect(loadCanonicalWithExtends(config, PROJECT_DIR)).rejects.toThrow(/does not exist/);
  });

  it('detects and imports native format when .agentsbridge/ is absent', async () => {
    // SHARED_DIR has no .agentsbridge/ — mockImportNative creates it
    mockDetect.mockResolvedValue('claude-code');
    mockImportNative.mockImplementation(async (repoPath: string) => {
      mkdirSync(join(repoPath, '.agentsbridge', 'rules'), { recursive: true });
      writeFileSync(
        join(repoPath, '.agentsbridge', 'rules', 'imported.md'),
        '---\ndescription: imported\n---\n# Imported rule\n',
      );
      return [];
    });

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'base', source: join('..', 'shared'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(mockDetect).toHaveBeenCalledWith(SHARED_DIR);
    expect(mockImportNative).toHaveBeenCalledWith(SHARED_DIR, 'claude-code');
    expect(canonical.rules.some((r) => r.body.includes('Imported rule'))).toBe(true);
    expect(canonical.rules.some((r) => r.body.includes('Local root'))).toBe(true);
  });

  it('uses explicit extend target instead of auto-detecting when provided', async () => {
    mockDetect.mockResolvedValue('claude-code');
    mockImportNative.mockImplementation(async (repoPath: string) => {
      mkdirSync(join(repoPath, '.agentsbridge', 'skills', 'chosen-skill'), { recursive: true });
      writeFileSync(
        join(repoPath, '.agentsbridge', 'skills', 'chosen-skill', 'SKILL.md'),
        '---\ndescription: imported skill\n---\n# Imported skill\n',
      );
      return [];
    });

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['skills'],
      extends: [
        {
          name: 'base',
          source: join('..', 'shared'),
          target: 'codex-cli',
          features: ['skills'],
        },
      ],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(mockDetect).not.toHaveBeenCalled();
    expect(mockImportNative).toHaveBeenCalledWith(SHARED_DIR, 'codex-cli');
    expect(canonical.skills.some((skill) => skill.name === 'chosen-skill')).toBe(true);
  });

  it('throws with a clear message when detectNativeFormat returns null', async () => {
    mockDetect.mockResolvedValue(null);
    mockImportNative.mockResolvedValue([]);

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'unknown-base', source: join('..', 'shared'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    await expect(loadCanonicalWithExtends(config, PROJECT_DIR)).rejects.toThrow(
      /No supported agent configuration found/,
    );
    await expect(loadCanonicalWithExtends(config, PROJECT_DIR)).rejects.toThrow(/unknown-base/);
  });

  it('loads Anthropic-style skills via extends.path', async () => {
    mkdirSync(join(SHARED_DIR, 'skills', 'alpha'), { recursive: true });
    writeFileSync(
      join(SHARED_DIR, 'skills', 'alpha', 'SKILL.md'),
      '---\ndescription: alpha skill\n---\n# Alpha\n',
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['skills'],
      extends: [
        {
          name: 'pack',
          source: join('..', 'shared'),
          path: 'skills',
          features: ['skills'],
        },
      ],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(canonical.skills.some((s) => s.name === 'alpha')).toBe(true);
  });

  it('imports at extend root when extends.path and extends.target are set (native tree)', async () => {
    mkdirSync(join(SHARED_DIR, '.gemini', 'commands'), { recursive: true });
    writeFileSync(join(SHARED_DIR, '.gemini', 'commands', 'x.toml'), 'name = "x"\n');

    mockImportNative.mockImplementation(async (repoPath: string) => {
      mkdirSync(join(repoPath, '.agentsbridge', 'commands'), { recursive: true });
      writeFileSync(
        join(repoPath, '.agentsbridge', 'commands', 'from-ext.md'),
        '---\ndescription: from ext\n---\n# From extend\n',
      );
      return [];
    });

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['commands'],
      extends: [
        {
          name: 'gemini',
          source: join('..', 'shared'),
          path: '.gemini/commands',
          target: 'gemini-cli',
          features: ['commands'],
        },
      ],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(mockImportNative).toHaveBeenCalledWith(SHARED_DIR, 'gemini-cli');
    expect(canonical.commands.some((c) => c.name === 'from-ext')).toBe(true);
  });

  it('skips import when extends.path and extends.target but .agentsbridge/ already exists', async () => {
    mkdirSync(join(SHARED_DIR, '.gemini', 'commands'), { recursive: true });
    writeFileSync(join(SHARED_DIR, '.gemini', 'commands', 'x.toml'), 'name = "x"\n');
    mkdirSync(join(SHARED_DIR, '.agentsbridge', 'commands'), { recursive: true });
    writeFileSync(
      join(SHARED_DIR, '.agentsbridge', 'commands', 'existing.md'),
      '---\ndescription: existing\n---\n# Existing\n',
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['commands'],
      extends: [
        {
          name: 'gemini',
          source: join('..', 'shared'),
          path: '.gemini/commands',
          target: 'gemini-cli',
          features: ['commands'],
        },
      ],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(mockImportNative).not.toHaveBeenCalled();
    expect(canonical.commands.some((c) => c.name === 'existing')).toBe(true);
  });

  it('merges packs between extends and local (extends → packs → local)', async () => {
    // Create a pack with a skill at .agentsbridge/packs/test-pack/
    const packDir = join(PROJECT_DIR, '.agentsbridge', 'packs', 'test-pack');
    const skillDir = join(packDir, 'skills', 'pack-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: from pack\n---\n# Pack skill\n');
    writeFileSync(
      join(packDir, 'pack.yaml'),
      [
        'name: test-pack',
        'source: github:org/repo@abc123',
        'source_kind: github',
        'installed_at: "2026-03-22T10:00:00Z"',
        'updated_at: "2026-03-22T10:00:00Z"',
        'content_hash: sha256:aabbcc',
        'features:',
        '  - skills',
      ].join('\n'),
    );

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules', 'skills'],
      extends: [],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };
    const { canonical } = await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(canonical.skills.some((s) => s.name === 'pack-skill')).toBe(true);
    expect(canonical.rules.some((r) => r.body.includes('Local root'))).toBe(true);
  });

  it('skips detection when .agentsbridge/ already exists (existing behavior unchanged)', async () => {
    // SHARED_DIR has .agentsbridge/ created here — detectNativeFormat must NOT be called
    mkdirSync(join(SHARED_DIR, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(SHARED_DIR, '.agentsbridge', 'rules', 'shared.md'),
      '---\ndescription: shared\n---\n# Shared rule\n',
    );
    mockDetect.mockResolvedValue('claude-code'); // would be wrong if called

    const config = {
      version: 1 as const,
      targets: ['claude-code'],
      features: ['rules'],
      extends: [{ name: 'base', source: join('..', 'shared'), features: ['rules'] }],
      overrides: {},
      collaboration: { strategy: 'merge' as const, lock_features: [] },
    };

    await loadCanonicalWithExtends(config, PROJECT_DIR);
    expect(mockDetect).not.toHaveBeenCalled();
    expect(mockImportNative).not.toHaveBeenCalled();
  });
});
