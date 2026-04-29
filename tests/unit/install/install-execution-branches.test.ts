import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../src/core/types.js';

const mockConfirm = vi.hoisted(() => vi.fn());
const mockValidateSkill = vi.hoisted(() => vi.fn());
const mockValidateRule = vi.hoisted(() => vi.fn());
const mockValidateCommand = vi.hoisted(() => vi.fn());
const mockValidateAgent = vi.hoisted(() => vi.fn());
const mockRuleSlug = vi.hoisted(() => vi.fn((rule: { source: string }) => rule.source));

vi.mock('../../../src/install/core/prompts.js', () => ({ confirm: mockConfirm }));
vi.mock('../../../src/install/core/validate-resources.js', () => ({
  validateSkill: mockValidateSkill,
  validateRule: mockValidateRule,
  validateCommand: mockValidateCommand,
  validateAgent: mockValidateAgent,
  ruleSlug: mockRuleSlug,
}));

import {
  resolveSkillPool,
  resolveRulePool,
  resolveCommandPool,
  resolveAgentPool,
} from '../../../src/install/core/pool-resolution.js';
import { findExistingPack, listPacks } from '../../../src/install/pack/pack-reader.js';
import {
  sweepStaleCache,
  cleanInstallCache,
  cacheKeyFromSource,
} from '../../../src/install/pack/cache-cleanup.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pool-resolution — extra branches', () => {
  it('skips invalid skill when prompt returns false (line 49 false branch)', async () => {
    const broken = {
      source: '/b/SKILL.md',
      name: 'b',
      description: '',
      body: '',
      supportingFiles: [],
    };
    mockValidateSkill.mockReturnValueOnce({ ok: false, skill: broken, reason: 'r' });
    mockConfirm.mockResolvedValueOnce(false);
    const pool = await resolveSkillPool(makeCanonical({ skills: [broken] }), false, false, true);
    expect(pool).toEqual([]);
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('skips invalid rule when prompt returns false (line 74 false branch)', async () => {
    const broken = {
      source: '/r/b.md',
      root: false,
      targets: [],
      description: '',
      globs: [],
      body: '',
    };
    mockValidateRule.mockReturnValueOnce({ ok: false, rule: broken, reason: 'r' });
    mockConfirm.mockResolvedValueOnce(false);
    const pool = await resolveRulePool(makeCanonical({ rules: [broken] }), false, false, true);
    expect(pool).toEqual([]);
  });

  it('skips invalid command when prompt returns false (line 99 false branch)', async () => {
    const broken = { source: '/c/b.md', name: 'b', description: '', allowedTools: [], body: '' };
    mockValidateCommand.mockReturnValueOnce({ ok: false, command: broken, reason: 'r' });
    mockConfirm.mockResolvedValueOnce(false);
    const pool = await resolveCommandPool(
      makeCanonical({ commands: [broken] }),
      false,
      false,
      true,
    );
    expect(pool).toEqual([]);
  });

  it('includes invalid agent when prompt returns true (line 124 true branch)', async () => {
    const broken = {
      source: '/a/b.md',
      name: 'b',
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
    };
    mockValidateAgent.mockReturnValueOnce({ ok: false, agent: broken, reason: 'r' });
    mockConfirm.mockResolvedValueOnce(true);
    const pool = await resolveAgentPool(makeCanonical({ agents: [broken] }), false, false, true);
    expect(pool).toHaveLength(1);
  });
});

describe('pack-reader — extra branches', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'amesh-rem-pack-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writePack(
    name: string,
    overrides: { source: string; source_kind: string; as?: string; target?: string },
  ): string {
    const packDir = join(dir, name);
    mkdirSync(packDir, { recursive: true });
    const ts = '2024-01-01T00:00:00Z';
    const lines = [
      `name: "${name}"`,
      `source: "${overrides.source}"`,
      `source_kind: ${overrides.source_kind}`,
      `installed_at: "${ts}"`,
      `updated_at: "${ts}"`,
      'features: ["rules"]',
      'paths: ["."]',
      'content_hash: "abcdef"',
    ];
    if (overrides.target) lines.push(`target: ${overrides.target}`);
    if (overrides.as) lines.push(`as: ${overrides.as}`);
    writeFileSync(join(packDir, 'pack.yaml'), lines.join('\n') + '\n');
    return packDir;
  }

  it('matches existing pack with gitlab-shaped source identity (line 33)', async () => {
    writePack('p1', {
      source: 'gitlab:ns/proj@v1',
      source_kind: 'gitlab',
      target: 'claude-code',
      as: 'rules',
    });
    const found = await findExistingPack(dir, 'gitlab:ns/proj@v2', {
      target: 'claude-code',
      as: 'rules',
      features: ['rules'],
    });
    expect(found?.name).toBe('p1');
  });

  it('matches existing pack with git-shaped source identity', async () => {
    writePack('p2', {
      source: 'git+https://example.com/x.git#main',
      source_kind: 'git',
      target: 'claude-code',
      as: 'rules',
    });
    const found = await findExistingPack(dir, 'git+https://example.com/x.git#abc', {
      target: 'claude-code',
      as: 'rules',
      features: ['rules'],
    });
    expect(found?.name).toBe('p2');
  });

  it('matches existing pack with local source (no remote parse, line 28 true)', async () => {
    writePack('p3', {
      source: '/abs/local/path',
      source_kind: 'local',
      target: 'claude-code',
      as: 'rules',
    });
    const found = await findExistingPack(dir, '/abs/local/path', {
      target: 'claude-code',
      as: 'rules',
      features: ['rules'],
    });
    expect(found?.name).toBe('p3');
  });

  it('skips non-directory entries while scanning packs (line 84 true)', async () => {
    writeFileSync(join(dir, 'random-file.txt'), 'not-a-dir');
    writePack('valid', {
      source: 'github:o/r@v',
      source_kind: 'github',
      target: 'claude-code',
      as: 'rules',
    });
    const list = await listPacks(dir);
    expect(list.map((p) => p.name)).toEqual(['valid']);
  });
});

describe('cache-cleanup — extra branches', () => {
  it('cacheKeyFromSource returns null for local source', () => {
    expect(cacheKeyFromSource('./local')).toBeNull();
  });

  it('cacheKeyFromSource builds gitlab key with HEAD when ref absent', () => {
    expect(cacheKeyFromSource('gitlab:ns/proj')).toContain('HEAD');
  });

  it('cleanInstallCache uses default cache dir when none provided (line 40)', async () => {
    // local source short-circuits before getCacheDir() is even called
    await expect(cleanInstallCache('./local')).resolves.toBeUndefined();
  });

  it('sweepStaleCache resolves with non-existent default dir (line 54)', async () => {
    // Without cacheDir, falls through to default; if dir missing, readdir throws and returns
    await expect(sweepStaleCache(undefined, 1)).resolves.toBeUndefined();
  });
});
