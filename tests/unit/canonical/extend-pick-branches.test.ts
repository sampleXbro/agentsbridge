import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyExtendPick } from '../../../src/canonical/extends/extend-pick.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { logger } from '../../../src/utils/output/logger.js';

function emptyCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

describe('applyExtendPick — branch coverage', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns the canonical unchanged when pick is undefined', () => {
    const c = emptyCanonical({ skills: [] });
    expect(applyExtendPick(c, ['skills'], undefined, 'ext')).toBe(c);
  });

  it('skips skills filtering when feature is not enabled', () => {
    const c = emptyCanonical({
      skills: [
        {
          source: '/a/skills/x/SKILL.md',
          name: 'x',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
    });
    const out = applyExtendPick(c, [], { skills: ['x'] }, 'ext');
    expect(out.skills).toHaveLength(1);
  });

  it('warns when a picked skill does not exist', () => {
    const c = emptyCanonical({
      skills: [
        {
          source: '/a/skills/x/SKILL.md',
          name: 'x',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
    });
    applyExtendPick(c, ['skills'], { skills: ['unknown'] }, 'my-ext');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"unknown" not found in skills from extend "my-ext"'),
    );
  });

  it('filters commands by pick and warns on missing names', () => {
    const c = emptyCanonical({
      commands: [
        { source: '/p/commands/run.md', name: 'run', description: '', allowedTools: [], body: '' },
      ],
    });
    const out = applyExtendPick(c, ['commands'], { commands: ['run', 'missing'] }, 'ext');
    expect(out.commands.map((cm) => cm.name)).toEqual(['run']);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"missing" not found in commands'),
    );
  });

  it('filters agents by pick and warns on missing names', () => {
    const c = emptyCanonical({
      agents: [
        {
          source: '/p/agents/a.md',
          name: 'a',
          description: '',
          tools: [],
          mcpServers: [],
          maxTurns: 0,
          model: '',
          permissionMode: '',
          disallowedTools: [],
          skills: [],
          memory: '',
          hooks: {},
          body: '',
        },
      ],
    });
    const out = applyExtendPick(c, ['agents'], { agents: ['a', 'gone'] }, 'ext');
    expect(out.agents).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"gone" not found in agents'));
  });

  it('skips command filtering when feature not enabled', () => {
    const c = emptyCanonical({
      commands: [
        { source: '/p/commands/run.md', name: 'run', description: '', allowedTools: [], body: '' },
      ],
    });
    const out = applyExtendPick(c, ['skills'], { commands: ['run'] }, 'ext');
    expect(out.commands).toHaveLength(1);
  });

  it('skips agents filtering when feature not enabled', () => {
    const c = emptyCanonical({
      agents: [
        {
          source: '/p/agents/a.md',
          name: 'a',
          description: '',
          tools: [],
          mcpServers: [],
          maxTurns: 0,
          model: '',
          permissionMode: '',
          disallowedTools: [],
          skills: [],
          memory: '',
          hooks: {},
          body: '',
        },
      ],
    });
    const out = applyExtendPick(c, ['skills'], { agents: ['a'] }, 'ext');
    expect(out.agents).toHaveLength(1);
  });

  it('skips rules filtering when feature not enabled', () => {
    const c = emptyCanonical({
      rules: [
        {
          source: '/p/rules/x.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    const out = applyExtendPick(c, [], { rules: ['x'] }, 'ext');
    expect(out.rules).toHaveLength(1);
  });

  it('warns when a picked rule does not exist', () => {
    const c = emptyCanonical({
      rules: [
        {
          source: '/p/rules/known.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '',
        },
      ],
    });
    applyExtendPick(c, ['rules'], { rules: ['known', 'absent'] }, 'pack');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"absent" not found in rules from extend "pack"'),
    );
  });

  it('returns unchanged when pick has no fields', () => {
    const c = emptyCanonical({
      skills: [
        {
          source: '/a/skills/x/SKILL.md',
          name: 'x',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
    });
    const out = applyExtendPick(c, ['skills'], {}, 'ext');
    expect(out.skills).toHaveLength(1);
  });
});
