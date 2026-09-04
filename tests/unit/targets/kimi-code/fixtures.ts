import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalRule,
  CanonicalSkill,
} from '../../../../src/core/types.js';
import type { GenerateFeatureContext } from '../../../../src/targets/catalog/target.interface.js';

export function projectCtx(): GenerateFeatureContext {
  return { capability: { level: 'native' }, scope: 'project' };
}

export function globalCtx(): GenerateFeatureContext {
  return { capability: { level: 'native' }, scope: 'global' };
}

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
    source: '/proj/.agentsmesh/rules/typescript.md',
    root: false,
    targets: [],
    description: 'TypeScript standards',
    globs: ['**/*.ts'],
    body: '# TypeScript\n\nNo `any`.',
    ...overrides,
  };
}

export function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '/proj/.agentsmesh/agents/code-reviewer.md',
    name: 'code-reviewer',
    description: 'Reviews diffs for defects',
    tools: ['Read', 'Grep'],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'Review the diff and report defects.',
    ...overrides,
  };
}

export function makeCommand(overrides: Partial<CanonicalCommand> = {}): CanonicalCommand {
  return {
    source: '/proj/.agentsmesh/commands/review.md',
    name: 'review',
    description: 'Review the working tree',
    allowedTools: ['Read'],
    body: 'Review the working tree.',
    ...overrides,
  };
}

export function makeSkill(overrides: Partial<CanonicalSkill> = {}): CanonicalSkill {
  return {
    source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
    name: 'api-generator',
    description: 'Scaffold REST routes',
    body: 'Scaffold a route.',
    supportingFiles: [],
    ...overrides,
  };
}
