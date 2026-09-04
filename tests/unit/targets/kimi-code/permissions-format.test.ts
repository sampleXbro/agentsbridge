/**
 * The accepted-pattern set mirrors `parsePattern`
 * (`agent-core-v2/src/agent/permissionRules/matchesRule.ts`), which throws only
 * on an empty string, a missing `)`, or an empty tool name. Tool names are
 * matched with `picomatch`, so globs and a bare `*` are legal.
 */

import { describe, it, expect } from 'vitest';
import {
  buildKimiPermissionRules,
  isValidKimiPermissionPattern,
  unmappedPermissionPatterns,
} from '../../../../src/targets/kimi-code/permissions-format.js';

describe('isValidKimiPermissionPattern', () => {
  it.each([
    ['Read'],
    ['*'],
    ['mcp__github__*'],
    ['mcp__*'],
    ['Bash()'],
    ['Bash(rm -rf*)'],
    ['Write(**/secrets/**)'],
    ['Bash(echo (nested))'],
    ['  Read  '],
  ])('accepts %s the way parsePattern does', (pattern) => {
    expect(isValidKimiPermissionPattern(pattern)).toBe(true);
  });

  it.each([[''], ['   '], ['Bash(rm'], ['(rm -rf)'], ['Read('], ['Bash(x)y']])(
    'refuses %s the way parsePattern throws',
    (pattern) => {
      expect(isValidKimiPermissionPattern(pattern)).toBe(false);
    },
  );
});

describe('buildKimiPermissionRules', () => {
  it('emits MCP globs and wildcards instead of silently dropping them', () => {
    expect(
      buildKimiPermissionRules({
        allow: ['Read', 'mcp__github__*'],
        deny: ['Bash(rm -rf*)', 'Write(**/secrets/**)', 'mcp__*'],
        ask: ['*'],
      }),
    ).toEqual([
      { decision: 'allow', pattern: 'Read' },
      { decision: 'allow', pattern: 'mcp__github__*' },
      { decision: 'ask', pattern: '*' },
      { decision: 'deny', pattern: 'Bash(rm -rf*)' },
      { decision: 'deny', pattern: 'Write(**/secrets/**)' },
      { decision: 'deny', pattern: 'mcp__*' },
    ]);
  });

  it('reports only the patterns parsePattern would reject', () => {
    const permissions = { allow: ['mcp__*', 'Bash(rm'], deny: [''], ask: ['*'] };
    expect(buildKimiPermissionRules(permissions)).toEqual([
      { decision: 'allow', pattern: 'mcp__*' },
      { decision: 'ask', pattern: '*' },
    ]);
    expect(unmappedPermissionPatterns(permissions)).toEqual(['Bash(rm', '']);
  });

  it('has nothing to do without permissions', () => {
    expect(buildKimiPermissionRules(null)).toEqual([]);
    expect(unmappedPermissionPatterns(null)).toEqual([]);
  });
});
