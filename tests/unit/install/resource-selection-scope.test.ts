import { describe, expect, it } from 'vitest';
import { narrowDiscoveredForInstallScope } from '../../../src/install/core/resource-selection.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function files(partial: Partial<CanonicalFiles>): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { docs: { command: 'npx', args: [], env: {}, type: 'stdio' } } },
    permissions: { allow: ['Read'], deny: ['Bash'] },
    hooks: { PreToolUse: [{ matcher: '*', command: 'pnpm lint' }] },
    ignore: ['dist'],
    ...partial,
  };
}

describe('narrowDiscoveredForInstallScope', () => {
  const canonical = files({
    skills: [
      { source: '/skills/a/SKILL.md', name: 'a', description: 'd', body: '', supportingFiles: [] },
      { source: '/skills/b/SKILL.md', name: 'b', description: 'd', body: '', supportingFiles: [] },
    ],
    rules: [
      {
        source: '/rules/keep.md',
        root: false,
        targets: [],
        description: 'keep',
        globs: [],
        body: '',
      },
      {
        source: '/rules/drop.md',
        root: false,
        targets: [],
        description: 'drop',
        globs: [],
        body: '',
      },
    ],
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
  });

  it('returns the original slice when no scope options are provided', () => {
    expect(narrowDiscoveredForInstallScope(canonical, {})).toBe(canonical);
  });

  it('derives scoped features from implicit picks and clears everything else', () => {
    const narrowed = narrowDiscoveredForInstallScope(canonical, {
      implicitPick: { rules: ['keep'], commands: [] },
    });

    expect(narrowed.rules.map((rule) => rule.source)).toEqual(['/rules/keep.md']);
    expect(narrowed.commands).toEqual([]);
    expect(narrowed.skills).toEqual([]);
    expect(narrowed.agents).toEqual([]);
    expect(narrowed.mcp).toBeNull();
    expect(narrowed.permissions).toBeNull();
    expect(narrowed.hooks).toBeNull();
    expect(narrowed.ignore).toEqual([]);
  });

  it('retains only scoped singleton features when no implicit picks are present', () => {
    const narrowed = narrowDiscoveredForInstallScope(canonical, {
      scopedFeatures: ['mcp', 'hooks', 'ignore'],
    });

    expect(narrowed.skills).toEqual([]);
    expect(narrowed.rules).toEqual([]);
    expect(narrowed.commands).toEqual([]);
    expect(narrowed.agents).toEqual([]);
    expect(narrowed.mcp).toEqual(canonical.mcp);
    expect(narrowed.permissions).toBeNull();
    expect(narrowed.hooks).toEqual(canonical.hooks);
    expect(narrowed.ignore).toEqual(['dist']);
  });

  it('combines explicit scoped features with filtered implicit picks', () => {
    const narrowed = narrowDiscoveredForInstallScope(canonical, {
      implicitPick: { skills: ['b'], agents: ['qa'] },
      scopedFeatures: ['skills', 'agents', 'permissions'],
    });

    expect(narrowed.skills.map((skill) => skill.name)).toEqual(['b']);
    expect(narrowed.agents.map((agent) => agent.name)).toEqual(['qa']);
    expect(narrowed.rules).toEqual([]);
    expect(narrowed.commands).toEqual([]);
    expect(narrowed.permissions).toEqual(canonical.permissions);
    expect(narrowed.mcp).toBeNull();
    expect(narrowed.hooks).toBeNull();
    expect(narrowed.ignore).toEqual([]);
  });
});
