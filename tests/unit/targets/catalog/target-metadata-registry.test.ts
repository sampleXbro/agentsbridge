import { describe, expect, it } from 'vitest';
import {
  TARGET_REGISTRY,
  listTargets,
  targetsByCategory,
  primaryImportRoot,
} from '../../../../src/targets/catalog/target-metadata-registry.js';
import { TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';

describe('TARGET_REGISTRY', () => {
  it('contains an entry for every builtin target id', () => {
    expect(Object.keys(TARGET_REGISTRY).sort()).toEqual([...TARGET_IDS].sort());
  });

  it('exposes well-formed metadata for every entry', () => {
    for (const id of TARGET_IDS) {
      const entry = TARGET_REGISTRY[id]!;
      expect(entry.metadata.displayName, `${id}.displayName`).toMatch(/.+/);
      expect(['cli', 'ide', 'agent-platform']).toContain(entry.metadata.category);
      expect(entry.metadata.officialUrl, `${id}.officialUrl`).toMatch(/^https?:\/\//);
      expect(entry.metadata.shortDescription, `${id}.shortDescription`).toMatch(/.+/);
    }
  });

  it('exposes project + global capabilities for every entry', () => {
    for (const id of TARGET_IDS) {
      const entry = TARGET_REGISTRY[id]!;
      expect(entry.capabilities.project.rules, `${id}.project.rules`).toBeDefined();
      expect(entry.capabilities.global.rules, `${id}.global.rules`).toBeDefined();
    }
  });

  it('mirrors the readonly id field on every entry', () => {
    for (const id of TARGET_IDS) {
      expect(TARGET_REGISTRY[id]!.id).toBe(id);
    }
  });
});

describe('listTargets()', () => {
  it('returns a stable alphabetized list of every target', () => {
    const ids = listTargets().map((t) => t.id);
    expect(ids).toEqual([...TARGET_IDS].sort());
  });
});

describe('targetsByCategory()', () => {
  it('groups every target by metadata.category and covers them all', () => {
    const groups = targetsByCategory();
    const total = groups.cli.length + groups.ide.length + groups['agent-platform'].length;
    expect(total).toBe(TARGET_IDS.length);
  });

  it('contains at least one target in each category', () => {
    const groups = targetsByCategory();
    expect(groups.cli.length).toBeGreaterThan(0);
    expect(groups.ide.length).toBeGreaterThan(0);
    expect(groups['agent-platform'].length).toBeGreaterThan(0);
  });
});

describe('primaryImportRoot()', () => {
  it('returns the first project-scope source path for claude-code', () => {
    const root = primaryImportRoot('claude-code', 'project');
    expect(root, 'claude-code project root').toMatch(/CLAUDE\.md$/);
  });

  it('returns the first project-scope source for codex-cli (root file AGENTS.md)', () => {
    expect(primaryImportRoot('codex-cli', 'project')).toBe('AGENTS.md');
  });

  it('returns undefined for an unknown target id', () => {
    expect(primaryImportRoot('definitely-not-a-real-target', 'project')).toBeUndefined();
  });

  it('returns the global-scope source when scope is global', () => {
    const root = primaryImportRoot('claude-code', 'global');
    expect(root, 'claude-code global root').toMatch(/CLAUDE\.md$/);
  });
});
