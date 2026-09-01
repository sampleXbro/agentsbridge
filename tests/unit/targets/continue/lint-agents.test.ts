import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonicalAgent, CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { runLint } from '../../../../src/core/lint/linter.js';
import { lintAgents } from '../../../../src/targets/continue/lint.js';
import { lintRules } from '../../../../src/targets/continue/linter.js';
import { target } from '../../../../src/targets/continue/index.js';

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '.agentsmesh/agents/reviewer.md',
    name: 'reviewer',
    description: 'Reviews code',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'You review code.',
    ...overrides,
  };
}

function makeCanonical(agents: CanonicalAgent[]): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents,
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function makeConfig(features: string[]): ValidatedConfig {
  return {
    version: 1,
    targets: ['continue'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

describe('lintAgents (continue)', () => {
  it('stays silent when every canonical field has a native home', () => {
    const canonical = makeCanonical([makeAgent({ tools: ['Read'], model: 'sonnet' })]);
    expect(lintAgents(canonical)).toEqual([]);
  });

  it('names the exact fields the markdown agent file drops', () => {
    const canonical = makeCanonical([
      makeAgent({ maxTurns: 7, mcpServers: ['github'], memory: 'notes.md' }),
    ]);

    const diagnostics = lintAgents(canonical);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      level: 'warning',
      target: 'continue',
      file: '.agentsmesh/agents/reviewer.md',
    });
    expect(diagnostics[0]!.message).toContain('.continue/agents/<name>.md');
    expect(diagnostics[0]!.message).toContain('ignores canonical maxTurns, mcpServers, memory ');
  });

  it('reports one diagnostic per lossy agent and none for clean ones', () => {
    const canonical = makeCanonical([
      makeAgent({ source: '.agentsmesh/agents/a.md', name: 'a' }),
      makeAgent({ source: '.agentsmesh/agents/b.md', name: 'b', skills: ['x'] }),
      makeAgent({ source: '.agentsmesh/agents/c.md', name: 'c', permissionMode: 'plan' }),
    ]);

    expect(lintAgents(canonical).map((d) => d.file)).toEqual([
      '.agentsmesh/agents/b.md',
      '.agentsmesh/agents/c.md',
    ]);
  });

  it('is no longer smuggled through the rule linter', () => {
    const canonical = makeCanonical([makeAgent({ maxTurns: 7 })]);
    expect(lintRules(canonical, '/proj', [], { scope: 'project' })).toEqual([]);
    expect(lintRules(canonical, '/proj', [], { scope: 'global' })).toEqual([]);
  });

  it('is wired as the target lint hook', () => {
    expect(target.lint).toBe(lintAgents);
  });
});

describe('runLint (continue) — agent warnings reach the agents feature', () => {
  const root = join(tmpdir(), 'am-continue-lint-agents');
  const canonical = makeCanonical([makeAgent({ maxTurns: 7 })]);

  it('warns when agents are generated without rules enabled', async () => {
    const { diagnostics } = await runLint(makeConfig(['agents', 'hooks']), canonical, root);

    const agentWarnings = diagnostics.filter((d) => d.file === '.agentsmesh/agents/reviewer.md');
    expect(agentWarnings).toHaveLength(1);
    expect(agentWarnings[0]!.message).toContain('ignores canonical maxTurns');
  });

  it('warns exactly once when rules and agents are both enabled', async () => {
    const { diagnostics } = await runLint(makeConfig(['rules', 'agents']), canonical, root);

    expect(diagnostics.filter((d) => d.file === '.agentsmesh/agents/reviewer.md')).toHaveLength(1);
  });

  /**
   * Known gap: `generators.lint` is feature-independent, so the warning also
   * fires for a config that never generates agents. Closing it needs a core
   * `lint.agents` dispatch gated on the agents feature.
   */
  it('also warns without the agents feature (no core lint.agents slot yet)', async () => {
    const { diagnostics } = await runLint(makeConfig(['rules']), canonical, root);

    expect(diagnostics.filter((d) => d.file === '.agentsmesh/agents/reviewer.md')).toHaveLength(1);
  });

  it('warns at global scope too, where the format is identical', async () => {
    const { diagnostics } = await runLint(makeConfig(['agents']), canonical, root, undefined, {
      scope: 'global',
    });

    expect(diagnostics.filter((d) => d.file === '.agentsmesh/agents/reviewer.md')).toHaveLength(1);
  });
});
