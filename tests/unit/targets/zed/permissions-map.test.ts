/**
 * Canonical permission entries <-> Zed `agent.tool_permissions` tool + regex.
 *
 * Zed matches `terminal` against the shell command string and the path tools
 * against the file path, both with Rust regexes (docs/src/ai/tool-permissions.md),
 * so canonical literals/globs are escaped and anchored rather than passed through.
 */

import { describe, it, expect } from 'vitest';
import {
  ZED_OWNED_TOOL_KEYS,
  toZedRule,
  fromZedRule,
} from '../../../../src/targets/zed/permissions-map.js';

describe('ZED_OWNED_TOOL_KEYS', () => {
  it('lists exactly the Zed tools agentsmesh can write', () => {
    expect([...ZED_OWNED_TOOL_KEYS]).toEqual([
      'terminal',
      'edit_file',
      'write_file',
      'fetch',
      'search_web',
    ]);
  });
});

describe('toZedRule', () => {
  it('anchors a literal command', () => {
    expect(toZedRule('Bash(ls)')).toEqual({ tool: 'terminal', regex: '^ls$' });
  });

  it('lets a `:*` prefix command also match its arguments', () => {
    expect(toZedRule('Bash(git status:*)')).toEqual({
      tool: 'terminal',
      regex: '^git status(\\s.*)?$',
    });
  });

  it('escapes regex metacharacters in a command literal', () => {
    expect(toZedRule('Bash(node -e "a.b()")')).toEqual({
      tool: 'terminal',
      regex: '^node -e "a\\.b\\(\\)"$',
    });
  });

  it('translates a path glob for the file tools', () => {
    expect(toZedRule('Edit(./src/**)')).toEqual({ tool: 'edit_file', regex: '^\\./src/.*$' });
    expect(toZedRule('Write(*.md)')).toEqual({ tool: 'write_file', regex: '^[^/]*\\.md$' });
    expect(toZedRule('Edit(a?c)')).toEqual({ tool: 'edit_file', regex: '^a[^/]c$' });
  });

  it('maps the web tools', () => {
    expect(toZedRule('WebFetch(docs.rs)')).toEqual({ tool: 'fetch', regex: '^docs\\.rs$' });
    expect(toZedRule('WebSearch(rust)')).toEqual({ tool: 'search_web', regex: '^rust$' });
  });

  it('maps a bare tool name to a tool-level default (regex null)', () => {
    expect(toZedRule('Bash')).toEqual({ tool: 'terminal', regex: null });
    expect(toZedRule(' Edit ')).toEqual({ tool: 'edit_file', regex: null });
  });

  it('returns null for tools Zed has no permission surface for', () => {
    // docs/src/ai/tool-permissions.md lists no read tool.
    expect(toZedRule('Read')).toBeNull();
    expect(toZedRule('Read(./src/**)')).toBeNull();
    expect(toZedRule('mcp__github__create_issue')).toBeNull();
    expect(toZedRule('')).toBeNull();
  });

  it('returns null for an empty payload', () => {
    expect(toZedRule('Bash()')).toBeNull();
    expect(toZedRule('Bash(   )')).toBeNull();
  });
});

describe('fromZedRule', () => {
  it('round-trips every generated form', () => {
    for (const pattern of [
      'Bash(ls)',
      'Bash(git status:*)',
      'Bash(node -e "a.b()")',
      'Edit(./src/**)',
      'Write(*.md)',
      'Edit(a?c)',
      'WebFetch(docs.rs)',
      'WebSearch(rust)',
      'Bash',
      'Edit',
    ]) {
      const rule = toZedRule(pattern)!;
      expect(fromZedRule(rule.tool, rule.regex), pattern).toBe(pattern.trim());
    }
  });

  it('returns null for an unknown tool', () => {
    expect(fromZedRule('delete_path', '^/etc$')).toBeNull();
  });

  it('returns null for a hand-written regex that is not anchored', () => {
    expect(fromZedRule('terminal', 'sudo\\s')).toBeNull();
    expect(fromZedRule('terminal', '^sudo')).toBeNull();
  });

  it('returns null when the anchored body is empty', () => {
    expect(fromZedRule('terminal', '^$')).toBeNull();
  });

  it('refuses a hand-written regex that would not re-encode byte for byte', () => {
    // Decoding this to a canonical literal and re-escaping it on the next
    // generate would silently disable the user's own rule.
    expect(fromZedRule('terminal', '^cargo\\s+(build|test)$')).toBeNull();
    expect(fromZedRule('edit_file', '^src/[a-z]+\\.ts$')).toBeNull();
  });
});
