import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintIgnore } from '../../../../src/targets/amazon-q/lint.js';
import { lintRules } from '../../../../src/targets/amazon-q/linter.js';

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

function messages(diagnostics: ReturnType<typeof lintIgnore>): string {
  return diagnostics.map((d) => d.message).join('\n');
}

describe('lintIgnore (amazon-q)', () => {
  it('returns empty when there are no ignore patterns', () => {
    expect(lintIgnore(makeCanonical({ agents: [makeAgent('coder')] }))).toHaveLength(0);
  });

  it('warns that patterns are dropped entirely when no agent exists to carry them', () => {
    const diagnostics = lintIgnore(makeCanonical({ ignore: ['dist', 'node_modules'] }));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].level).toBe('warning');
    expect(diagnostics[0].target).toBe('amazon-q');
    expect(diagnostics[0].file).toBe('.agentsmesh/ignore');
    expect(diagnostics[0].message).toContain('2 ignore pattern');
    expect(diagnostics[0].message).toContain('.agentsmesh/agents');
  });

  it('warns that deniedPaths only apply while the generated agent is selected', () => {
    const diagnostics = lintIgnore(
      makeCanonical({ agents: [makeAgent('coder')], ignore: ['src/generated/**'] }),
    );
    expect(messages(diagnostics)).toContain('chat.defaultAgent');
    expect(messages(diagnostics)).toContain('--agent');
  });

  it('names the patterns Amazon Q anchors to the working directory', () => {
    const diagnostics = lintIgnore(
      makeCanonical({ agents: [makeAgent('coder')], ignore: ['node_modules', '*.log'] }),
    );
    const text = messages(diagnostics);
    expect(text).toContain('node_modules');
    expect(text).toContain('*.log');
    expect(text).toContain('**/');
  });

  it('does not flag patterns that already contain a separator', () => {
    const diagnostics = lintIgnore(
      makeCanonical({
        agents: [makeAgent('coder')],
        ignore: ['**/node_modules', 'src/gen/**', '/build'],
      }),
    );
    expect(messages(diagnostics)).not.toContain('every depth');
  });

  it('names dropped gitignore negation patterns', () => {
    const diagnostics = lintIgnore(
      makeCanonical({ agents: [makeAgent('coder')], ignore: ['build/**', '!build/keep.txt'] }),
    );
    const text = messages(diagnostics);
    expect(text).toContain('!build/keep.txt');
    expect(text).toContain('negation');
  });

  it('warns that canonical ignore has no per-agent scope once several agents exist', () => {
    const diagnostics = lintIgnore(
      makeCanonical({
        agents: [makeAgent('restricted'), makeAgent('open')],
        ignore: ['secrets/**'],
      }),
    );
    const text = messages(diagnostics);
    expect(text).toContain('per-agent');
    expect(text).toContain('restricted, open');
    expect(text).toContain('secrets/**');
  });

  it('does not raise the per-agent scope warning for a single agent', () => {
    const diagnostics = lintIgnore(
      makeCanonical({ agents: [makeAgent('coder')], ignore: ['secrets/**'] }),
    );
    expect(messages(diagnostics)).not.toContain('per-agent');
  });
});

describe('lintRules (amazon-q) — unreachable global rules', () => {
  const rule: CanonicalFiles['rules'][number] = {
    source: '/proj/.agentsmesh/rules/_root.md',
    root: true,
    targets: [],
    description: '',
    globs: [],
    body: 'Root body.',
  };

  it('warns in global scope when no agent references the generated rules', () => {
    const diagnostics = lintRules(makeCanonical({ rules: [rule] }), '/proj', [], {
      scope: 'global',
    });
    const warning = diagnostics.find((d) => d.message.includes('Add an agent'));
    expect(warning).toBeDefined();
    expect(warning!.level).toBe('warning');
    expect(warning!.target).toBe('amazon-q');
    expect(warning!.file).toBe('.agentsmesh/rules');
  });

  it('warns in global scope that agent-carried rules load only while that agent is selected', () => {
    const diagnostics = lintRules(
      makeCanonical({ rules: [rule], agents: [makeAgent('coder'), makeAgent('writer')] }),
      '/proj',
      [],
      { scope: 'global' },
    );
    const warning = diagnostics.find((d) => d.message.includes('chat.defaultAgent'));
    expect(warning).toBeDefined();
    expect(warning!.level).toBe('warning');
    expect(warning!.target).toBe('amazon-q');
    expect(warning!.file).toBe('.agentsmesh/rules');
    expect(warning!.message).toContain('coder, writer');
    // The "add an agent" advice makes no sense once agents exist.
    expect(diagnostics.some((d) => d.message.includes('Add an agent'))).toBe(false);
  });

  it('does not warn in project scope where the built-in default agent reads the rules glob', () => {
    const diagnostics = lintRules(makeCanonical({ rules: [rule] }), '/proj', [], {
      scope: 'project',
    });
    expect(diagnostics.some((d) => d.message.includes('no global rules directory'))).toBe(false);
  });

  it('does not warn when no rule is visible to amazon-q', () => {
    const diagnostics = lintRules(
      makeCanonical({ rules: [{ ...rule, root: false, targets: ['claude-code'] }] }),
      '/proj',
      [],
      { scope: 'global' },
    );
    expect(diagnostics.some((d) => d.message.includes('no global rules directory'))).toBe(false);
  });
});
