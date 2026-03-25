import { describe, it, expect } from 'vitest';
import {
  buildInstallPick,
  deriveInstallFeatures,
  ensureInstallSelection,
} from '../../../src/install/install-entry-selection.js';
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

describe('resource-selection', () => {
  it('deriveInstallFeatures drops empty array features', () => {
    expect(
      deriveInstallFeatures(['skills', 'rules', 'mcp'], {
        skillNames: ['a'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      }).sort(),
    ).toEqual(['mcp', 'skills'].sort());
  });

  it('deriveInstallFeatures keeps only non-array features when arrays empty', () => {
    expect(
      deriveInstallFeatures(['skills', 'hooks'], {
        skillNames: [],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      }),
    ).toEqual(['hooks']);
  });

  it('buildInstallPick adds pick when subset of pool', () => {
    const pick = buildInstallPick({
      pathInRepo: '',
      preConflictCounts: { skills: 2, rules: 0, commands: 0, agents: 0 },
      selected: {
        skillNames: ['a'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick?.skills).toEqual(['a']);
  });

  it('buildInstallPick omits pick when full pool and no implicit', () => {
    const pick = buildInstallPick({
      pathInRepo: 'x/y',
      preConflictCounts: { skills: 2, rules: 0, commands: 0, agents: 0 },
      selected: {
        skillNames: ['a', 'b'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick).toBeUndefined();
  });

  it('buildInstallPick path hint for single resource', () => {
    const pick = buildInstallPick({
      pathInRepo: 'upstream/skills/demo',
      preConflictCounts: { skills: 1, rules: 0, commands: 0, agents: 0 },
      selected: {
        skillNames: ['demo'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick?.skills).toEqual(['demo']);
  });

  it('buildInstallPick omits pick when single resource path segment mismatch', () => {
    const pick = buildInstallPick({
      pathInRepo: 'other/path',
      preConflictCounts: { skills: 1, rules: 0, commands: 0, agents: 0 },
      selected: {
        skillNames: ['solo'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick).toBeUndefined();
  });

  it('buildInstallPick can combine multiple categories', () => {
    const pick = buildInstallPick({
      pathInRepo: '',
      preConflictCounts: { skills: 2, rules: 2, commands: 0, agents: 0 },
      selected: {
        skillNames: ['a'],
        ruleSlugs: ['r1'],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick?.skills).toEqual(['a']);
    expect(pick?.rules).toEqual(['r1']);
  });

  it('buildInstallPick includes pick when implicitPick names a category', () => {
    const pick = buildInstallPick({
      pathInRepo: '',
      implicitPick: { rules: ['x'] },
      preConflictCounts: { skills: 0, rules: 1, commands: 0, agents: 0 },
      selected: {
        skillNames: [],
        ruleSlugs: ['x'],
        commandNames: [],
        agentNames: [],
      },
    });
    expect(pick?.rules).toEqual(['x']);
  });

  it('ensureInstallSelection accepts singleton-only installs and rejects empty selections', () => {
    expect(() =>
      ensureInstallSelection({
        selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
        discoveredFeatures: ['hooks'],
        preConflict: { skills: 0, rules: 0, commands: 0, agents: 0 },
      }),
    ).not.toThrow();
    expect(() =>
      ensureInstallSelection({
        selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
        discoveredFeatures: [],
        preConflict: { skills: 0, rules: 0, commands: 0, agents: 0 },
      }),
    ).toThrow('No resources selected to install.');
  });

  it('ensureInstallSelection reports dropped array categories', () => {
    expect(() =>
      ensureInstallSelection({
        selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
        discoveredFeatures: ['skills'],
        preConflict: { skills: 1, rules: 0, commands: 0, agents: 0 },
      }),
    ).toThrow('No skills selected to install.');
  });
});
