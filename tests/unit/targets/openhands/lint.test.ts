import { describe, it, expect } from 'vitest';
import type { CanonicalAgent, CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';
import {
  lintAgents,
  lintHooks,
  lintMcp,
  lintPermissions,
} from '../../../../src/targets/openhands/lint.js';
import { lintRules } from '../../../../src/targets/openhands/linter.js';

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

function makeRule(slug: string, overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: `.agentsmesh/rules/${slug}.md`,
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: `# ${slug}`,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '.agentsmesh/agents/code-reviewer.md',
    name: 'code-reviewer',
    description: 'Reviews code',
    tools: ['Read'],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'You review.',
    ...overrides,
  };
}

describe('lintPermissions (openhands)', () => {
  it('names the dropped allow/deny/ask entries', () => {
    const diagnostics = lintPermissions(
      makeCanonical({
        permissions: { allow: ['Read', 'Grep'], deny: ['WebFetch'], ask: ['Bash(rm:*)'] },
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.target).toBe('openhands');
    expect(diagnostics[0]!.file).toBe('.agentsmesh/permissions.yaml');
    expect(diagnostics[0]!.message).toContain('Read, Grep');
    expect(diagnostics[0]!.message).toContain('WebFetch');
    expect(diagnostics[0]!.message).toContain('Bash(rm:*)');
  });

  // DEFECT 9: the old message claimed the per-agent `tools:` grant was the only
  // permission surface. `permission_mode` (subagent/schema.py) is the real one.
  it('names permission_mode as the real surface and never claims tools: is it', () => {
    const message = lintPermissions(
      makeCanonical({ permissions: { allow: ['Read'], deny: [] } }),
    )[0]!.message;
    expect(message).toContain('permission_mode');
    expect(message).toContain('always_confirm');
    expect(message).not.toContain('only permission surface is the per-agent tools:');
  });

  it('stays quiet when there is nothing to drop', () => {
    expect(lintPermissions(makeCanonical())).toEqual([]);
    expect(lintPermissions(makeCanonical({ permissions: { allow: [], deny: [] } }))).toEqual([]);
  });
});

describe('lintHooks (openhands)', () => {
  it('warns that a project hooks.json completely suppresses the global one', () => {
    const messages = lintHooks(
      makeCanonical({ hooks: { PostToolUse: [{ matcher: '*', command: 'fmt' }] } }),
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('.openhands/hooks.json'))).toBe(true);
    expect(messages.some((m) => m.includes('first'))).toBe(true);
  });

  it('names every unsupported hook event', () => {
    const messages = lintHooks(
      makeCanonical({ hooks: { Notification: [{ matcher: '*', command: 'ping' }] } }),
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('Notification'))).toBe(true);
  });

  it('does not warn about agentsmesh best-effort events', () => {
    const messages = lintHooks(
      makeCanonical({
        hooks: { PostToolUseFailure: [{ matcher: '*', command: 'agentsmesh lessons hook' }] },
      }),
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('PostToolUseFailure'))).toBe(false);
  });

  // DEFECT 10: HookType.PROMPT is a real handler type, so a prompt hook is now
  // written; only an entry with neither command nor prompt is dropped.
  it('never claims prompt handlers are dropped', () => {
    const messages = lintHooks(
      makeCanonical({
        hooks: { Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'wrap up' }] },
      }),
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('prompt handlers'))).toBe(false);
  });

  it('names events with an entry that has neither a command nor a prompt', () => {
    const messages = lintHooks(
      makeCanonical({ hooks: { SessionEnd: [{ matcher: '*', command: '' }] } }),
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('SessionEnd') && m.includes('dropped'))).toBe(true);
  });

  it('stays quiet with no hooks', () => {
    expect(lintHooks(makeCanonical())).toEqual([]);
    expect(lintHooks(makeCanonical({ hooks: {} }))).toEqual([]);
  });
});

// DEFECT 5/6: `.agents/agents/<name>.md` is written with antigravity's serializer
// so the shared path stays byte-identical, which means canonical fields land as
// camelCase keys outside `KNOWN_FIELDS` (subagent/schema.py).
describe('lintAgents (openhands)', () => {
  it('names every canonical agent field OpenHands ignores', () => {
    const diagnostics = lintAgents(
      makeCanonical({
        agents: [
          makeAgent({
            disallowedTools: ['Bash'],
            permissionMode: 'acceptEdits',
            maxTurns: 12,
            mcpServers: ['docs'],
            memory: 'notes.md',
          }),
        ],
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.target).toBe('openhands');
    expect(diagnostics[0]!.file).toBe('.agentsmesh/agents/code-reviewer.md');
    for (const field of ['disallowedTools', 'maxTurns', 'mcpServers', 'memory', 'permissionMode']) {
      expect(diagnostics[0]!.message).toContain(field);
    }
    expect(diagnostics[0]!.message).toContain('permission_mode');
  });

  it('stays quiet for an agent that only uses fields OpenHands reads', () => {
    expect(
      lintAgents(makeCanonical({ agents: [makeAgent({ model: 'inherit', skills: ['api'] })] })),
    ).toEqual([]);
  });

  it('warns that agent hooks never run, because the entry shape is not a HookMatcher', () => {
    const diagnostics = lintAgents(
      makeCanonical({
        agents: [makeAgent({ hooks: { PreToolUse: [{ matcher: '*', command: 'guard.sh' }] } })],
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('hooks');
    expect(diagnostics[0]!.message).not.toContain('skips the whole agent');
  });

  // `HookConfig.model_validate` raises "Unknown event type" for a PascalCase key
  // outside the six, and `load_agents_from_dir` swallows it and skips the file.
  it('escalates when agent hooks carry an event OpenHands refuses to load', () => {
    const diagnostics = lintAgents(
      makeCanonical({
        agents: [
          makeAgent({
            hooks: {
              PreToolUse: [{ matcher: '*', command: 'guard.sh' }],
              Notification: [{ matcher: '*', command: 'ping.sh' }],
              SubagentStop: [{ matcher: '*', command: 'done.sh' }],
            },
          }),
        ],
      }),
    );
    expect(diagnostics).toHaveLength(2);
    const fatal = diagnostics.find((d) => d.message.includes('skips the whole agent'))!;
    expect(fatal.message).toContain('Notification');
    expect(fatal.message).toContain('SubagentStop');
    expect(fatal.message).not.toContain('PreToolUse');
  });

  it('stays quiet with no agents', () => {
    expect(lintAgents(makeCanonical())).toEqual([]);
  });
});

describe('lintMcp (openhands)', () => {
  it('names remote servers the shared plugin .mcp.json cannot carry', () => {
    const diagnostics = lintMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            local: { type: 'stdio', command: 'npx', args: [], env: {} },
            remote: { type: 'http', url: 'https://example.com/mcp', headers: {}, env: {} },
          },
        },
      }),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('remote');
    expect(diagnostics[0]!.message).not.toContain('local');
  });

  it('stays quiet when every server is stdio', () => {
    expect(
      lintMcp(
        makeCanonical({
          mcp: { mcpServers: { local: { type: 'stdio', command: 'npx', args: [], env: {} } } },
        }),
      ),
    ).toEqual([]);
    expect(lintMcp(makeCanonical())).toEqual([]);
  });
});

describe('lintRules (openhands)', () => {
  it('warns that AGENTS.md is injected verbatim so the root description is dropped', () => {
    const messages = lintRules(
      makeCanonical({ rules: [makeRule('_root', { root: true, description: 'Standards' })] }),
      '/tmp/x',
      [],
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('AGENTS.md') && m.includes('description'))).toBe(true);
  });

  it('warns that a non-root rule with no globs is always injected', () => {
    const messages = lintRules(makeCanonical({ rules: [makeRule('style')] }), '/tmp/x', []).map(
      (d) => d.message,
    );
    expect(messages.some((m) => m.includes('style') && m.includes('paths'))).toBe(true);
  });

  it('stays quiet for a path-scoped rule and a description-less root rule', () => {
    const diagnostics = lintRules(
      makeCanonical({
        rules: [
          makeRule('_root', { root: true }),
          makeRule('typescript', { globs: ['src/**/*.ts'] }),
        ],
      }),
      '/tmp/x',
      ['src/index.ts'],
      { scope: 'global' },
    );
    expect(diagnostics).toEqual([]);
  });
});
