/**
 * The `agent` key merge: `settings.json` is the user's editor config, so a
 * generate pass may only rewrite the pattern entries agentsmesh itself could
 * have produced. A hand-written Rust regex — exactly the shape `fromZedRule`
 * refuses to import — must survive every run.
 */

import { describe, it, expect } from 'vitest';
import { mergeZedAgent } from '../../../../src/targets/zed/permissions-merge.js';

describe('mergeZedAgent', () => {
  it('keeps unrelated agent settings and unowned tool entries', () => {
    const base = {
      default_model: { provider: 'zed.dev', model: 'claude' },
      tool_permissions: {
        default: 'allow',
        tools: {
          delete_path: { always_deny: [{ pattern: '^/etc$' }] },
          terminal: { always_allow: [{ pattern: '^rm$' }] },
        },
      },
    };
    const merged = mergeZedAgent(base, {
      tool_permissions: { tools: { terminal: { default: 'deny' } } },
    });
    expect(merged).toEqual({
      default_model: { provider: 'zed.dev', model: 'claude' },
      tool_permissions: {
        default: 'allow',
        tools: {
          delete_path: { always_deny: [{ pattern: '^/etc$' }] },
          terminal: { default: 'deny' },
        },
      },
    });
  });

  it('keeps hand-written regexes on an owned tool while writing the canonical ones', () => {
    const base = {
      tool_permissions: {
        tools: {
          terminal: {
            always_allow: [{ pattern: '^cargo\\s+(build|test)$' }],
            always_deny: [{ pattern: '^sudo' }],
          },
          edit_file: { always_deny: [{ pattern: 'secrets?/' }] },
        },
      },
    };
    const merged = mergeZedAgent(base, {
      tool_permissions: {
        tools: {
          terminal: { always_allow: [{ pattern: '^git status(\\s.*)?$', case_sensitive: true }] },
        },
      },
    });
    expect(merged).toEqual({
      tool_permissions: {
        tools: {
          terminal: {
            always_allow: [
              { pattern: '^git status(\\s.*)?$', case_sensitive: true },
              { pattern: '^cargo\\s+(build|test)$' },
            ],
            always_deny: [{ pattern: '^sudo' }],
          },
          edit_file: { always_deny: [{ pattern: 'secrets?/' }] },
        },
      },
    });
  });

  it('revokes only the patterns agentsmesh could have written', () => {
    const base = {
      tool_permissions: {
        tools: { terminal: { always_allow: [{ pattern: '^ls$' }, { pattern: '^sudo' }] } },
      },
    };
    expect(mergeZedAgent(base, { tool_permissions: { tools: {} } })).toEqual({
      tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^sudo' }] } } },
    });
  });

  it('revokes: an owned tool that canonical no longer produces is removed', () => {
    const base = {
      tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^rm$' }] } } },
    };
    expect(mergeZedAgent(base, { tool_permissions: { tools: {} } })).toBeUndefined();
  });

  it('revokes a stale allow default but keeps a hand-written restriction', () => {
    const grant = { tool_permissions: { tools: { terminal: { default: 'allow' } } } };
    expect(mergeZedAgent(grant, { tool_permissions: { tools: {} } })).toBeUndefined();

    const restriction = {
      tool_permissions: {
        tools: { terminal: { default: 'confirm' }, edit_file: { default: 'deny' } },
      },
    };
    expect(mergeZedAgent(restriction, { tool_permissions: { tools: {} } })).toEqual(restriction);
  });

  it('revokes one list while keeping a hand-written default on the same tool', () => {
    const base = {
      tool_permissions: {
        tools: { terminal: { default: 'confirm', always_allow: [{ pattern: '^rm$' }] } },
      },
    };
    expect(mergeZedAgent(base, { tool_permissions: { tools: {} } })).toEqual({
      tool_permissions: { tools: { terminal: { default: 'confirm' } } },
    });
  });

  it('is idempotent: re-merging its own output changes nothing', () => {
    const base = {
      tool_permissions: {
        tools: { terminal: { always_allow: [{ pattern: '^cargo\\s+(build|test)$' }] } },
      },
    };
    const overlay = {
      tool_permissions: {
        tools: { terminal: { always_allow: [{ pattern: '^ls$', case_sensitive: true }] } },
      },
    };
    const once = mergeZedAgent(base, overlay);
    expect(mergeZedAgent(once, overlay)).toEqual(once);
  });

  it('builds the agent key from nothing when the file has none', () => {
    expect(
      mergeZedAgent(undefined, { tool_permissions: { tools: { terminal: { default: 'allow' } } } }),
    ).toEqual({ tool_permissions: { tools: { terminal: { default: 'allow' } } } });
  });

  it('drops a non-object base agent value rather than merging into it', () => {
    expect(mergeZedAgent('nope', { tool_permissions: { tools: {} } })).toBeUndefined();
  });

  it('ignores malformed pattern entries in the file instead of dropping the list', () => {
    const base = {
      tool_permissions: {
        tools: { terminal: { always_allow: ['not-an-object', { pattern: 7 }] } },
      },
    };
    expect(mergeZedAgent(base, { tool_permissions: { tools: {} } })).toEqual({
      tool_permissions: {
        tools: { terminal: { always_allow: ['not-an-object', { pattern: 7 }] } },
      },
    });
  });
});
