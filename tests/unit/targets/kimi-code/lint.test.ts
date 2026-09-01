import { describe, it, expect } from 'vitest';
import { lintAgents, lintHooks, lintPermissions } from '../../../../src/targets/kimi-code/lint.js';
import { lintRules } from '../../../../src/targets/kimi-code/linter.js';
import { makeAgent, makeCanonical, makeRule } from './fixtures.js';

const hooks = { PostToolUse: [{ matcher: 'Write', command: 'fmt' }] };
const permissions = { allow: ['Read'], deny: [], ask: [] };

function messages(diagnostics: { message: string }[]): string {
  return diagnostics.map((d) => d.message).join('\n');
}

describe('lintHooks (kimi-code)', () => {
  it('says hooks are user-scope only at project scope', () => {
    const diagnostics = lintHooks(makeCanonical({ hooks }), { scope: 'project' });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.file).toBe('.agentsmesh/hooks.yaml');
    expect(diagnostics[0]!.message).toContain('~/.kimi-code/config.toml');
  });

  it('names every hook the strict TOML schema would refuse at global scope', () => {
    const diagnostics = lintHooks(
      makeCanonical({
        hooks: {
          PreCommit: [{ matcher: '', command: 'lint' }],
          Stop: [{ matcher: '', command: '', type: 'prompt', prompt: 'summarize' }],
          PostToolUse: [{ matcher: 'Write', command: 'fmt', timeout: 9000 }],
        },
      }),
      { scope: 'global' },
    );
    const text = messages(diagnostics);
    expect(diagnostics).toHaveLength(3);
    expect(text).toContain('PreCommit');
    expect(text).toContain('prompt-type hooks');
    expect(text).toContain('1–600 seconds');
  });

  it('is quiet when every hook maps cleanly', () => {
    expect(lintHooks(makeCanonical({ hooks }), { scope: 'global' })).toEqual([]);
  });

  it('is quiet when canonical has no hook entries', () => {
    expect(lintHooks(makeCanonical())).toEqual([]);
    expect(lintHooks(makeCanonical({ hooks: { PostToolUse: [] } }))).toEqual([]);
  });
});

describe('lintPermissions (kimi-code)', () => {
  it('says permissions are user-scope only at project scope', () => {
    const diagnostics = lintPermissions(makeCanonical({ permissions }), { scope: 'project' });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.file).toBe('.agentsmesh/permissions.yaml');
    expect(diagnostics[0]!.message).toContain('[[permission.rules]]');
  });

  it('names the patterns that would break the config load', () => {
    const diagnostics = lintPermissions(
      makeCanonical({ permissions: { allow: ['Read', 'Bash('], deny: ['(rm -rf)'], ask: [] } }),
      { scope: 'global' },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Bash(');
    expect(diagnostics[0]!.message).toContain('(rm -rf)');
  });

  it('says nothing about an MCP glob or a wildcard Kimi Code accepts', () => {
    expect(
      lintPermissions(
        makeCanonical({ permissions: { allow: ['mcp__github__*'], deny: ['*'], ask: [] } }),
        { scope: 'global' },
      ),
    ).toEqual([]);
  });

  it('is quiet for mappable patterns and for empty permissions', () => {
    expect(lintPermissions(makeCanonical({ permissions }), { scope: 'global' })).toEqual([]);
    expect(lintPermissions(makeCanonical())).toEqual([]);
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [] } }), { scope: 'global' }),
    ).toEqual([]);
  });
});

describe('lintAgents (kimi-code)', () => {
  it('names each canonical agent field the frontmatter drops', () => {
    const diagnostics = lintAgents(
      makeCanonical({
        agents: [
          makeAgent({
            model: 'kimi-k2',
            permissionMode: 'auto',
            maxTurns: 4,
            mcpServers: ['context7'],
            hooks: { Stop: [{ matcher: '', command: 'x' }] },
            skills: ['api-generator'],
            memory: 'notes.md',
          }),
        ],
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.file).toBe('/proj/.agentsmesh/agents/code-reviewer.md');
    expect(diagnostics[0]!.message).toContain(
      'model, permissionMode, maxTurns, mcpServers, hooks, skills, memory',
    );
  });

  it('is quiet for an agent that only uses supported fields', () => {
    expect(lintAgents(makeCanonical({ agents: [makeAgent()] }))).toEqual([]);
  });
});

describe('lintRules (kimi-code)', () => {
  it('tags diagnostics with the target and skips glob checks in global scope', () => {
    const canonical = makeCanonical({
      rules: [
        makeRule({ source: '/proj/.agentsmesh/rules/_root.md', root: true, globs: [] }),
        makeRule({ globs: ['src/**/*.missing'] }),
      ],
    });
    const project = lintRules(canonical, '/proj', [], { scope: 'project' });
    expect(project).toHaveLength(1);
    expect(project[0]!.target).toBe('kimi-code');
    expect(project[0]!.message).toContain('src/**/*.missing');
    expect(lintRules(canonical, '/proj', [], { scope: 'global' })).toEqual([]);
  });
});
