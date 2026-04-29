import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  hasArrayResources,
  hasInstallableResources,
  resolveSkillPool,
  resolveRulePool,
  resolveCommandPool,
  resolveAgentPool,
} from '../../../src/install/core/pool-resolution.js';

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

describe('hasArrayResources / hasInstallableResources', () => {
  it('returns false for empty canonical', () => {
    const c = makeCanonical();
    expect(hasArrayResources(c)).toBe(false);
    expect(hasInstallableResources(c)).toBe(false);
  });

  it('detects mcp-only canonical as installable but not array', () => {
    const c = makeCanonical({ mcp: { mcpServers: {} } });
    expect(hasArrayResources(c)).toBe(false);
    expect(hasInstallableResources(c)).toBe(true);
  });

  it('detects permissions-only canonical', () => {
    const c = makeCanonical({ permissions: { allow: [], deny: [] } as never });
    expect(hasInstallableResources(c)).toBe(true);
  });

  it('detects hooks-only canonical', () => {
    const c = makeCanonical({ hooks: {} as never });
    expect(hasInstallableResources(c)).toBe(true);
  });

  it('detects ignore-only canonical', () => {
    const c = makeCanonical({ ignore: ['dist'] });
    expect(hasInstallableResources(c)).toBe(true);
  });

  it('detects array resources via skills', () => {
    const c = makeCanonical({
      skills: [
        { source: '/x/SKILL.md', name: 'x', description: '', body: '', supportingFiles: [] },
      ],
    });
    expect(hasArrayResources(c)).toBe(true);
  });
});

describe('resolveSkillPool — branches', () => {
  const valid = {
    source: '/v/SKILL.md',
    name: 'valid',
    description: '',
    body: '',
    supportingFiles: [],
  };
  const broken = {
    source: '/b/SKILL.md',
    name: 'broken',
    description: '',
    body: '',
    supportingFiles: [],
  };

  it('uses force to include all candidates regardless of validity', async () => {
    mockValidateSkill
      .mockReturnValueOnce({ ok: true, skill: valid })
      .mockReturnValueOnce({ ok: false, skill: broken, reason: 'bad' });
    const pool = await resolveSkillPool(
      makeCanonical({ skills: [valid, broken] }),
      true,
      false,
      false,
    );
    expect(pool.map((s) => s.name).sort()).toEqual(['broken', 'valid']);
  });

  it('skips invalid in dry-run regardless of tty', async () => {
    mockValidateSkill
      .mockReturnValueOnce({ ok: true, skill: valid })
      .mockReturnValueOnce({ ok: false, skill: broken, reason: 'bad' });
    const pool = await resolveSkillPool(
      makeCanonical({ skills: [valid, broken] }),
      false,
      true,
      true,
    );
    expect(pool.map((s) => s.name)).toEqual(['valid']);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('prompts in interactive mode and includes invalid skill on yes', async () => {
    mockValidateSkill
      .mockReturnValueOnce({ ok: true, skill: valid })
      .mockReturnValueOnce({ ok: false, skill: broken, reason: 'bad' });
    mockConfirm.mockResolvedValue(true);
    const pool = await resolveSkillPool(
      makeCanonical({ skills: [valid, broken] }),
      false,
      false,
      true,
    );
    expect(pool.map((s) => s.name).sort()).toEqual(['broken', 'valid']);
    expect(mockConfirm).toHaveBeenCalledOnce();
  });

  it('skips invalid in non-tty without force', async () => {
    mockValidateSkill.mockReturnValueOnce({ ok: false, skill: broken, reason: 'bad' });
    const pool = await resolveSkillPool(makeCanonical({ skills: [broken] }), false, false, false);
    expect(pool).toEqual([]);
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});

describe('resolveRulePool — branches', () => {
  const valid = {
    source: '/r/v.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '',
  };
  const broken = {
    source: '/r/b.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '',
  };

  it('force returns all', async () => {
    mockValidateRule
      .mockReturnValueOnce({ ok: true, rule: valid })
      .mockReturnValueOnce({ ok: false, rule: broken, reason: 'bad' });
    const pool = await resolveRulePool(
      makeCanonical({ rules: [valid, broken] }),
      true,
      false,
      false,
    );
    expect(pool).toHaveLength(2);
  });

  it('prompt yes adds invalid rule', async () => {
    mockValidateRule.mockReturnValueOnce({ ok: false, rule: broken, reason: 'bad' });
    mockConfirm.mockResolvedValue(true);
    const pool = await resolveRulePool(makeCanonical({ rules: [broken] }), false, false, true);
    expect(pool).toHaveLength(1);
    expect(mockRuleSlug).toHaveBeenCalled();
  });

  it('dryRun strips invalid rule', async () => {
    mockValidateRule
      .mockReturnValueOnce({ ok: true, rule: valid })
      .mockReturnValueOnce({ ok: false, rule: broken, reason: 'bad' });
    const pool = await resolveRulePool(
      makeCanonical({ rules: [valid, broken] }),
      false,
      true,
      false,
    );
    expect(pool).toHaveLength(1);
  });
});

describe('resolveCommandPool — branches', () => {
  const valid = { source: '/c/v.md', name: 'v', description: '', allowedTools: [], body: '' };
  const broken = { source: '/c/b.md', name: 'b', description: '', allowedTools: [], body: '' };

  it('force includes invalid', async () => {
    mockValidateCommand.mockReturnValueOnce({ ok: false, command: broken, reason: 'x' });
    const pool = await resolveCommandPool(
      makeCanonical({ commands: [broken] }),
      true,
      false,
      false,
    );
    expect(pool).toHaveLength(1);
  });

  it('prompt yes adds invalid command', async () => {
    mockValidateCommand.mockReturnValueOnce({ ok: false, command: broken, reason: 'x' });
    mockConfirm.mockResolvedValue(true);
    const pool = await resolveCommandPool(
      makeCanonical({ commands: [broken] }),
      false,
      false,
      true,
    );
    expect(pool).toHaveLength(1);
  });

  it('dryRun returns only valid commands', async () => {
    mockValidateCommand
      .mockReturnValueOnce({ ok: true, command: valid })
      .mockReturnValueOnce({ ok: false, command: broken, reason: 'x' });
    const pool = await resolveCommandPool(
      makeCanonical({ commands: [valid, broken] }),
      false,
      true,
      true,
    );
    expect(pool.map((c) => c.name)).toEqual(['v']);
  });
});

describe('resolveAgentPool — branches', () => {
  const validAgent = {
    source: '/a/v.md',
    name: 'v',
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
  const brokenAgent = { ...validAgent, source: '/a/b.md', name: 'b' };

  it('force returns both valid and invalid agents', async () => {
    mockValidateAgent
      .mockReturnValueOnce({ ok: true, agent: validAgent })
      .mockReturnValueOnce({ ok: false, agent: brokenAgent, reason: 'r' });
    const pool = await resolveAgentPool(
      makeCanonical({ agents: [validAgent, brokenAgent] }),
      true,
      false,
      false,
    );
    expect(pool).toHaveLength(2);
  });

  it('prompt no excludes invalid agent', async () => {
    mockValidateAgent.mockReturnValueOnce({ ok: false, agent: brokenAgent, reason: 'r' });
    mockConfirm.mockResolvedValue(false);
    const pool = await resolveAgentPool(
      makeCanonical({ agents: [brokenAgent] }),
      false,
      false,
      true,
    );
    expect(pool).toEqual([]);
  });

  it('dryRun keeps only valid agents', async () => {
    mockValidateAgent
      .mockReturnValueOnce({ ok: true, agent: validAgent })
      .mockReturnValueOnce({ ok: false, agent: brokenAgent, reason: 'r' });
    const pool = await resolveAgentPool(
      makeCanonical({ agents: [validAgent, brokenAgent] }),
      false,
      true,
      true,
    );
    expect(pool.map((a) => a.name)).toEqual(['v']);
  });
});
