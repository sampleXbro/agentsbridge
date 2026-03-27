import { describe, it, expect } from 'vitest';
import {
  validateAgent,
  validateCommand,
  validateRule,
  validateSkill,
  ruleSlug,
} from '../../../src/install/core/validate-resources.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalRule,
  CanonicalSkill,
} from '../../../src/core/types.js';

const skill = (d: string): CanonicalSkill => ({
  source: '/x/SKILL.md',
  name: 'n',
  description: d,
  body: '',
  supportingFiles: [],
});

const rule = (d: string): CanonicalRule => ({
  source: '/proj/rules/foo.md',
  root: false,
  targets: [],
  description: d,
  globs: [],
  body: '',
});

const cmd = (d: string): CanonicalCommand => ({
  source: '/proj/commands/c.md',
  name: 'c',
  description: d,
  allowedTools: [],
  body: '',
});

const agent = (d: string): CanonicalAgent => ({
  source: '/proj/agents/a.md',
  name: 'a',
  description: d,
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
});

describe('validate-resources (install)', () => {
  it('validateSkill requires description', () => {
    expect(validateSkill(skill('')).ok).toBe(false);
    expect(validateSkill(skill('ok')).ok).toBe(true);
  });

  it('validateRule requires description', () => {
    expect(validateRule(rule('')).ok).toBe(false);
    expect(validateRule(rule('x')).ok).toBe(true);
  });

  it('validateCommand requires description', () => {
    expect(validateCommand(cmd('')).ok).toBe(false);
    expect(validateCommand(cmd('x')).ok).toBe(true);
  });

  it('validateAgent requires description', () => {
    expect(validateAgent(agent('')).ok).toBe(false);
    expect(validateAgent(agent('x')).ok).toBe(true);
  });

  it('ruleSlug derives from source basename', () => {
    expect(ruleSlug(rule('d'))).toBe('foo');
  });

  it('ruleSlug strips .MD case-insensitively', () => {
    const r: CanonicalRule = {
      source: '/p/rules/Q.MD',
      root: false,
      targets: [],
      description: 'd',
      globs: [],
      body: '',
    };
    expect(ruleSlug(r)).toBe('Q');
  });

  it('rejects whitespace-only description', () => {
    expect(validateSkill(skill('   ')).ok).toBe(false);
    expect(validateRule(rule(' \t\n')).ok).toBe(false);
  });
});
