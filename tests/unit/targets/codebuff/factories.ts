/** Canonical factories shared by the codebuff unit tests. */

import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

export function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

export function makeRule(overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: '/proj/.agentsmesh/rules/example.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '# Example',
    ...overrides,
  };
}
