import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  lintAgents,
  lintPermissions,
  lintHooks,
  lintIgnore,
} from '../../../../src/targets/codebuff/lint.js';

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

function agent(name: string): CanonicalFiles['agents'][number] {
  return {
    source: `/proj/.agentsmesh/agents/${name}.md`,
    name,
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'Do the thing.',
  };
}

describe('lintAgents (codebuff)', () => {
  it('stays silent when there are no canonical agents', () => {
    expect(lintAgents(makeCanonical())).toEqual([]);
  });

  it('names every dropped agent and says why', () => {
    const diagnostics = lintAgents(
      makeCanonical({ agents: [agent('code-reviewer'), agent('researcher')] }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.level).toBe('warning');
    expect(diagnostics[0]?.target).toBe('codebuff');
    expect(diagnostics[0]?.file).toBe('.agentsmesh/agents');
    expect(diagnostics[0]?.message).toContain('code-reviewer');
    expect(diagnostics[0]?.message).toContain('researcher');
    expect(diagnostics[0]?.message).toContain('TypeScript');
  });
});

describe('lintPermissions (codebuff)', () => {
  it('stays silent for absent or empty permissions', () => {
    expect(lintPermissions(makeCanonical())).toEqual([]);
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toEqual([]);
  });

  it('names the dropped allow, deny and ask entries', () => {
    const diagnostics = lintPermissions(
      makeCanonical({
        permissions: { allow: ['Read'], deny: ['Bash(rm)'], ask: ['WebFetch'] },
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Read');
    expect(diagnostics[0]?.message).toContain('Bash(rm)');
    expect(diagnostics[0]?.message).toContain('WebFetch');
  });

  it('tolerates permissions with no ask list', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: ['Read'], deny: [] } })),
    ).toHaveLength(1);
  });
});

describe('lintHooks (codebuff)', () => {
  it('stays silent when hooks are absent or empty', () => {
    expect(lintHooks(makeCanonical())).toEqual([]);
    expect(lintHooks(makeCanonical({ hooks: { PreToolUse: [] } }))).toEqual([]);
  });

  it('names the dropped hook events', () => {
    const diagnostics = lintHooks(
      makeCanonical({ hooks: { PreToolUse: [{ command: 'echo a' }], Stop: [] } }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('PreToolUse');
    expect(diagnostics[0]?.message).not.toContain('Stop');
  });
});

describe('lintIgnore (codebuff)', () => {
  it('stays silent at project scope, where .codebuffignore is written', () => {
    expect(lintIgnore(makeCanonical({ ignore: ['dist/'] }), { scope: 'project' })).toEqual([]);
    expect(lintIgnore(makeCanonical({ ignore: ['dist/'] }))).toEqual([]);
  });

  it('warns at global scope, where no ignore file exists', () => {
    const diagnostics = lintIgnore(makeCanonical({ ignore: ['dist/', 'build/'] }), {
      scope: 'global',
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.file).toBe('.agentsmesh/ignore');
    expect(diagnostics[0]?.message).toContain('dist/');
    expect(diagnostics[0]?.message).toContain('build/');
  });

  it('stays silent at global scope when canonical ignore is empty', () => {
    expect(lintIgnore(makeCanonical(), { scope: 'global' })).toEqual([]);
  });

  it('ignores malformed lint options', () => {
    expect(lintIgnore(makeCanonical({ ignore: ['dist/'] }), 'nonsense')).toEqual([]);
  });
});
