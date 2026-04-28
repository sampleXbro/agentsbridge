/**
 * Hook-script reference lint guard: hook commands that reference
 * external script files (e.g. `./scripts/foo.sh`) must produce a lint warning
 * for any target that does not copy those scripts into the generated tree, so
 * users do not silently ship hook configs pointing at missing files.
 */

import { describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { lintHookScriptReferences } from '../../../src/core/lint/shared/hook-script-references.js';

function canonicalWithHooks(commands: readonly string[]): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: {
      sessionStart: commands.map((command) => ({ matcher: '*', command })),
    },
    ignore: [],
  };
}

describe('lintHookScriptReferences', () => {
  it('returns no diagnostics when canonical has no hooks', () => {
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
    expect(lintHookScriptReferences({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('returns no diagnostics when hook commands are inline (no script reference)', () => {
    const canonical = canonicalWithHooks(['echo hello', 'pnpm test', 'node -e "console.log(1)"']);
    expect(lintHookScriptReferences({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('warns for relative script references like ./scripts/foo.sh', () => {
    const canonical = canonicalWithHooks(['./scripts/foo.sh']);
    const diagnostics = lintHookScriptReferences({ target: 'claude-code', canonical });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.level).toBe('warning');
    expect(diagnostics[0]?.target).toBe('claude-code');
    expect(diagnostics[0]?.file).toBe('.agentsmesh/hooks.yaml');
    expect(diagnostics[0]?.message).toMatch(/script/i);
    expect(diagnostics[0]?.message).toMatch(/foo\.sh/);
  });

  it('warns for `bash scripts/foo.sh` form', () => {
    const canonical = canonicalWithHooks(['bash scripts/foo.sh --flag']);
    const diagnostics = lintHookScriptReferences({ target: 'cursor', canonical });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/scripts\/foo\.sh/);
  });

  it('warns for parent-relative script references (../scripts/foo.sh)', () => {
    const canonical = canonicalWithHooks(['../scripts/foo.sh']);
    const diagnostics = lintHookScriptReferences({ target: 'cursor', canonical });
    expect(diagnostics).toHaveLength(1);
  });

  it('emits one diagnostic per distinct hook entry that references a script', () => {
    const canonical = canonicalWithHooks([
      './scripts/start.sh',
      'echo inline',
      './scripts/lint.sh',
    ]);
    const diagnostics = lintHookScriptReferences({ target: 'windsurf', canonical });
    expect(diagnostics).toHaveLength(2);
  });

  it('does not warn for absolute paths', () => {
    const canonical = canonicalWithHooks(['/usr/local/bin/foo']);
    const diagnostics = lintHookScriptReferences({ target: 'claude-code', canonical });
    expect(diagnostics).toEqual([]);
  });

  it('does not warn for commands using PATH-resolved binaries', () => {
    const canonical = canonicalWithHooks(['ls -la', 'cat README.md']);
    const diagnostics = lintHookScriptReferences({ target: 'cline', canonical });
    expect(diagnostics).toEqual([]);
  });

  it('returns empty when target has script projection (e.g. copilot)', () => {
    const canonical = canonicalWithHooks(['./scripts/foo.sh']);
    expect(
      lintHookScriptReferences({ target: 'copilot', canonical, hasScriptProjection: true }),
    ).toEqual([]);
  });

  it('returns empty for a plugin target that declares script projection', () => {
    const canonical = canonicalWithHooks(['./scripts/foo.sh']);
    expect(
      lintHookScriptReferences({ target: 'my-plugin', canonical, hasScriptProjection: true }),
    ).toEqual([]);
  });

  it('warns for a plugin target without script projection', () => {
    const canonical = canonicalWithHooks(['./scripts/foo.sh']);
    const diagnostics = lintHookScriptReferences({
      target: 'my-plugin',
      canonical,
      hasScriptProjection: false,
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.target).toBe('my-plugin');
  });

  it('handles empty string command without warning', () => {
    const canonical = canonicalWithHooks(['']);
    expect(lintHookScriptReferences({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('handles whitespace-only command without warning', () => {
    const canonical = canonicalWithHooks(['   ']);
    expect(lintHookScriptReferences({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('detects scripts across multiple hook events', () => {
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: {
        PreToolUse: [{ matcher: '*', command: './scripts/a.sh' }],
        Notification: [{ matcher: '*', command: './scripts/b.sh' }],
      },
      ignore: [],
    };
    const diagnostics = lintHookScriptReferences({ target: 'cursor', canonical });
    expect(diagnostics).toHaveLength(2);
  });

  it('handles hook entry with missing command property', () => {
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: { sessionStart: [{ matcher: '*' } as never] },
      ignore: [],
    };
    expect(lintHookScriptReferences({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('detects quoted script references', () => {
    const canonical = canonicalWithHooks(['"./scripts/foo.sh"']);
    const diagnostics = lintHookScriptReferences({ target: 'cursor', canonical });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toMatch(/foo\.sh/);
  });
});
