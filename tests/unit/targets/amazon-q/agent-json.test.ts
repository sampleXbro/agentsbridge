import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { GenerateFeatureContext } from '../../../../src/targets/catalog/target.interface.js';
import { generateAgents } from '../../../../src/targets/amazon-q/generator.js';
import {
  AMAZON_Q_PROJECT_RULES_RESOURCE,
  AMAZON_Q_GLOBAL_RULES_RESOURCE,
  AMAZON_Q_DEFAULT_AGENT_RESOURCES,
} from '../../../../src/targets/amazon-q/constants.js';

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

function makeAgent(name: string): CanonicalFiles['agents'][number] {
  return {
    source: `/proj/.agentsmesh/agents/${name}.md`,
    name,
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: 'default',
    maxTurns: 0,
    mcpServers: [],
    hooks: {} as import('../../../../src/core/hook-types.js').Hooks,
    skills: [],
    memory: '',
    body: 'Agent body.',
  };
}

function makeRule(source: string, targets: string[] = []): CanonicalFiles['rules'][number] {
  return { source, root: false, targets, description: '', globs: [], body: 'Rule body.' };
}

const projectCtx: GenerateFeatureContext = { capability: { level: 'native' }, scope: 'project' };
const globalCtx: GenerateFeatureContext = { capability: { level: 'native' }, scope: 'global' };

function parseFirst(
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
): Record<string, unknown> {
  const [result] = generateAgents(canonical, ctx);
  return JSON.parse(result.content) as Record<string, unknown>;
}

const PROJECT_RESOURCES = [...AMAZON_Q_DEFAULT_AGENT_RESOURCES, AMAZON_Q_PROJECT_RULES_RESOURCE];
const GLOBAL_RESOURCES = [...PROJECT_RESOURCES, AMAZON_Q_GLOBAL_RULES_RESOURCE];

describe('generateAgents (amazon-q) — embedded rule resources', () => {
  it('matches Agent::default() resources: the three doc files plus the project rules glob', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      rules: [makeRule('/proj/.agentsmesh/rules/typescript.md')],
    });
    const parsed = parseFirst(canonical, projectCtx);
    expect(parsed.resources).toEqual([
      'file://AmazonQ.md',
      'file://AGENTS.md',
      'file://README.md',
      'file://.amazonq/rules/**/*.md',
    ]);
  });

  it('defaults to project scope when no feature context is supplied', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      rules: [makeRule('/proj/.agentsmesh/rules/typescript.md')],
    });
    expect(parseFirst(canonical).resources).toEqual(PROJECT_RESOURCES);
  });

  it('adds the home-expanded global rules glob in global scope', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      rules: [makeRule('/proj/.agentsmesh/rules/typescript.md')],
    });
    expect(parseFirst(canonical, globalCtx).resources).toEqual(GLOBAL_RESOURCES);
  });

  it('keeps the rules glob when no rule is visible to amazon-q', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('coder')],
      rules: [makeRule('/proj/.agentsmesh/rules/claude.md', ['claude-code'])],
    });
    expect(parseFirst(canonical, projectCtx).resources).toEqual(PROJECT_RESOURCES);
  });

  it('keeps the rules glob when there are no canonical rules at all', () => {
    const canonical = makeCanonical({ agents: [makeAgent('coder')] });
    expect(parseFirst(canonical, globalCtx).resources).toEqual(GLOBAL_RESOURCES);
  });

  it('emits resources for every generated agent', () => {
    const canonical = makeCanonical({
      agents: [makeAgent('a'), makeAgent('b')],
      rules: [makeRule('/proj/.agentsmesh/rules/typescript.md')],
    });
    const results = generateAgents(canonical, globalCtx);
    expect(results).toHaveLength(2);
    for (const result of results) {
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      expect(parsed.resources).toEqual(GLOBAL_RESOURCES);
    }
  });
});
