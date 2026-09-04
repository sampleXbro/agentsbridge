/**
 * `.agents/agents/` is a managed directory (see layout.ts), so `generate`
 * deletes any file in it that canonical does not produce. Lint has to name those
 * files first, because on an existing Antigravity workspace every one of them is
 * hand-written and the fix is `agentsmesh import --from antigravity`.
 */
import { describe, it, expect } from 'vitest';
import type { CanonicalAgent, CanonicalFiles, LintDiagnostic } from '../../../../src/core/types.js';
import { lintRules } from '../../../../src/targets/antigravity/linter.js';

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

function makeAgent(name: string): CanonicalAgent {
  return {
    source: `.agentsmesh/agents/${name}.md`,
    name,
    description: 'x',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'x',
  };
}

function run(canonical: CanonicalFiles, files: string[]): LintDiagnostic[] {
  return lintRules(canonical, '/tmp/nope', files, { scope: 'project' });
}

describe('antigravity orphan agent files', () => {
  it('names a native agent file canonical does not produce', () => {
    const diagnostics = run(makeCanonical({ agents: [makeAgent('kept')] }), [
      '.agents/agents/kept.md',
      '.agents/agents/hand-written.md',
      'src/index.ts',
    ]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.target).toBe('antigravity');
    expect(diagnostics[0]!.message).toContain('.agents/agents/hand-written.md');
    expect(diagnostics[0]!.message).toContain('import --from antigravity');
    expect(diagnostics[0]!.message).not.toContain('kept.md');
  });

  it('stays quiet when every agent file comes from canonical', () => {
    expect(run(makeCanonical({ agents: [makeAgent('kept')] }), ['.agents/agents/kept.md'])).toEqual(
      [],
    );
  });

  it('stays quiet in global scope, where no project files are scanned', () => {
    expect(
      lintRules(makeCanonical(), '/tmp/nope', ['.agents/agents/hand-written.md'], {
        scope: 'global',
      }),
    ).toEqual([]);
  });
});
