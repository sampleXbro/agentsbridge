import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintPermissions, lintIgnore } from '../../../../src/targets/roo-code/lint.js';

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

describe('lintPermissions (roo-code, project scope)', () => {
  it('is silent when only allow/deny are set (natively projected into .vscode/settings.json)', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Bash'], deny: [], ask: [] } });
    expect(lintPermissions(canonical, { scope: 'project' })).toHaveLength(0);
  });

  it('warns when "ask" rules are present (no Roo Code equivalent)', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: ['WebSearch'] },
    });
    const results = lintPermissions(canonical, { scope: 'project' });
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].message).toContain('ask');
  });

  it('returns empty when permissions is null', () => {
    expect(lintPermissions(makeCanonical(), { scope: 'project' })).toHaveLength(0);
  });

  it('returns empty when all permission arrays are empty', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: [] } });
    expect(lintPermissions(canonical, { scope: 'project' })).toHaveLength(0);
  });

  it('defaults to project-scope behavior when no options are passed', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Bash'], deny: [] } });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });
});

describe('lintPermissions (roo-code, global scope)', () => {
  it('warns that global permissions have no deterministic VS Code user-settings path', () => {
    const canonical = makeCanonical({ permissions: { allow: ['Bash'], deny: [] } });
    const results = lintPermissions(canonical, { scope: 'global' });
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].message).toContain('Settings UI');
  });

  it('returns empty when permissions is null in global scope', () => {
    expect(lintPermissions(makeCanonical(), { scope: 'global' })).toHaveLength(0);
  });

  it('returns empty in global scope when allow/deny/ask are all empty', () => {
    const canonical = makeCanonical({ permissions: { allow: [], deny: [], ask: [] } });
    expect(lintPermissions(canonical, { scope: 'global' })).toHaveLength(0);
  });
});

describe('lintIgnore (roo-code)', () => {
  it('is silent in project scope (natively projected into .rooignore)', () => {
    const canonical = makeCanonical({ ignore: ['.env'] });
    expect(lintIgnore(canonical, { scope: 'project' })).toHaveLength(0);
  });

  it('warns in global scope when canonical ignore patterns exist', () => {
    const canonical = makeCanonical({ ignore: ['.env'] });
    const results = lintIgnore(canonical, { scope: 'global' });
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
  });

  it('is silent in global scope when there are no ignore patterns', () => {
    expect(lintIgnore(makeCanonical(), { scope: 'global' })).toHaveLength(0);
  });

  it('defaults to project-scope behavior when no options are passed', () => {
    expect(lintIgnore(makeCanonical({ ignore: ['.env'] }))).toHaveLength(0);
  });
});
