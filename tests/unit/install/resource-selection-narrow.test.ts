import { describe, it, expect } from 'vitest';
import { narrowDiscoveredForImplicitPick } from '../../../src/install/core/resource-selection.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function files(partial: Partial<CanonicalFiles>): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...partial,
  };
}

describe('narrowDiscoveredForImplicitPick', () => {
  it('applies multiple axes at once', () => {
    const c = files({
      skills: [
        { source: '/a/a/SKILL.md', name: 'a', description: 'd', body: '', supportingFiles: [] },
      ],
      rules: [
        {
          source: '/p/rules/keep.md',
          root: false,
          targets: [],
          description: 'd',
          globs: [],
          body: '',
        },
        {
          source: '/p/rules/drop.md',
          root: false,
          targets: [],
          description: 'd',
          globs: [],
          body: '',
        },
      ],
    });
    const n = narrowDiscoveredForImplicitPick(c, { rules: ['keep'], skills: ['a'] });
    expect(n.rules.map((r) => r.source)).toEqual([c.rules[0]!.source]);
    expect(n.skills.length).toBe(1);
  });

  it('removes rules when implicit names missing (skills omitted from pick → cleared)', () => {
    const c = files({
      skills: [
        { source: '/a/x/SKILL.md', name: 'x', description: 'd', body: '', supportingFiles: [] },
      ],
      rules: [
        {
          source: '/p/rules/r.md',
          root: false,
          targets: [],
          description: 'd',
          globs: [],
          body: '',
        },
      ],
    });
    const n = narrowDiscoveredForImplicitPick(c, { rules: ['ghost'] });
    expect(n.rules.length).toBe(0);
    expect(n.skills.length).toBe(0);
  });

  it('filters skills by name list', () => {
    const c = files({
      skills: [
        { source: '/a/x/SKILL.md', name: 'a', description: 'd', body: '', supportingFiles: [] },
        { source: '/a/b/SKILL.md', name: 'b', description: 'd', body: '', supportingFiles: [] },
      ],
      rules: [
        {
          source: '/p/rules/r1.md',
          root: false,
          targets: [],
          description: 'd',
          globs: [],
          body: '',
        },
      ],
    });
    const n = narrowDiscoveredForImplicitPick(c, { skills: ['b'] });
    expect(n.skills.map((s) => s.name)).toEqual(['b']);
    expect(n.rules.length).toBe(0);
  });

  it('filters commands and agents while clearing omitted categories and singleton features', () => {
    const c = files({
      commands: [
        {
          source: '/commands/review.md',
          name: 'review',
          description: 'd',
          allowedTools: [],
          body: '',
        },
        { source: '/commands/test.md', name: 'test', description: 'd', allowedTools: [], body: '' },
      ],
      agents: [
        {
          source: '/agents/reviewer.md',
          name: 'reviewer',
          description: 'd',
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
        {
          source: '/agents/qa.md',
          name: 'qa',
          description: 'd',
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
      mcp: { mcpServers: { docs: { command: 'npx', args: [], env: {}, type: 'stdio' } } },
      permissions: { allow: ['Read'], deny: [] },
      hooks: { PreToolUse: [{ matcher: '*', command: 'pnpm lint' }] },
      ignore: ['dist'],
    });

    const n = narrowDiscoveredForImplicitPick(c, { commands: ['test'], agents: [] });

    expect(n.commands.map((command) => command.name)).toEqual(['test']);
    expect(n.agents).toEqual([]);
    expect(n.skills).toEqual([]);
    expect(n.rules).toEqual([]);
    expect(n.mcp).toBeNull();
    expect(n.permissions).toBeNull();
    expect(n.hooks).toBeNull();
    expect(n.ignore).toEqual([]);
  });
});
