import { describe, it, expect } from 'vitest';
import { narrowDiscoveredForImplicitPick } from '../../../src/install/resource-selection.js';
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
});
