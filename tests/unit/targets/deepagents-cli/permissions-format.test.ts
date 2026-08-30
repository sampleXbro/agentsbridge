import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import type { Permissions } from '../../../../src/core/types.js';
import {
  serializeDeepagentsConfig,
  parseDeepagentsPermissions,
  shellAllowList,
  unmappedPermissionEntries,
} from '../../../../src/targets/deepagents-cli/permissions-format.js';

function makePermissions(overrides: Partial<Permissions> = {}): Permissions {
  return { allow: [], deny: [], ...overrides };
}

describe('shellAllowList', () => {
  it('extracts shell commands from Bash(...) patterns and drops the :* suffix', () => {
    const permissions = makePermissions({ allow: ['Bash(npm run test:*)', 'Bash(git status)'] });
    expect(shellAllowList(permissions)).toEqual(['npm run test', 'git status']);
  });

  it('skips non-shell tool patterns and bare Bash', () => {
    const permissions = makePermissions({ allow: ['Read', 'Grep', 'Bash', 'Read(./.env)'] });
    expect(shellAllowList(permissions)).toEqual([]);
  });

  it('dedupes commands that collapse to the same prefix', () => {
    const permissions = makePermissions({ allow: ['Bash(git status:*)', 'Bash(git status)'] });
    expect(shellAllowList(permissions)).toEqual(['git status']);
  });

  it('returns [] for null permissions', () => {
    expect(shellAllowList(null)).toEqual([]);
  });

  it('skips Bash() patterns with an empty command', () => {
    expect(shellAllowList(makePermissions({ allow: ['Bash()', 'Bash(:*)'] }))).toEqual([]);
  });
});

describe('unmappedPermissionEntries', () => {
  it('reports non-shell allow entries plus every deny and ask entry', () => {
    const permissions = makePermissions({
      allow: ['Read', 'Bash(npm run test:*)'],
      deny: ['WebFetch', 'Bash(curl:*)'],
      ask: ['Bash(git push:*)'],
    });
    expect(unmappedPermissionEntries(permissions)).toEqual({
      allow: ['Read'],
      deny: ['WebFetch', 'Bash(curl:*)'],
      ask: ['Bash(git push:*)'],
    });
  });

  it('returns empty buckets for null permissions', () => {
    expect(unmappedPermissionEntries(null)).toEqual({ allow: [], deny: [], ask: [] });
  });

  it('treats a missing ask field as empty', () => {
    const permissions = makePermissions({ allow: ['Bash(ls:*)'], deny: [] });
    expect(unmappedPermissionEntries(permissions).ask).toEqual([]);
  });
});

describe('serializeDeepagentsConfig', () => {
  it('writes shell.allow_list and pins startup.mode to manual', () => {
    const content = serializeDeepagentsConfig(
      makePermissions({ allow: ['Bash(npm run test:*)'], deny: ['WebFetch'] }),
      null,
    );
    expect(content).not.toBeNull();
    expect(parseToml(content!)).toEqual({
      shell: { allow_list: ['npm run test'] },
      startup: { mode: 'manual' },
    });
    expect(content!.endsWith('\n')).toBe(true);
  });

  it('returns null when no allow entry maps to a shell command', () => {
    const permissions = makePermissions({ allow: ['Read'], deny: ['Bash(curl:*)'] });
    expect(serializeDeepagentsConfig(permissions, null)).toBeNull();
  });

  it('returns null for null permissions', () => {
    expect(serializeDeepagentsConfig(null, null)).toBeNull();
  });

  it('preserves unrelated keys and tables in an existing config.toml', () => {
    const existing = [
      'model = "claude-opus-4"',
      '',
      '[credentials]',
      'api_key = "sk-secret"',
      '',
      '[display]',
      'theme = "dark"',
      '',
    ].join('\n');

    const content = serializeDeepagentsConfig(makePermissions({ allow: ['Bash(ls:*)'] }), existing);

    expect(parseToml(content!)).toEqual({
      model: 'claude-opus-4',
      credentials: { api_key: 'sk-secret' },
      display: { theme: 'dark' },
      shell: { allow_list: ['ls'] },
      startup: { mode: 'manual' },
    });
  });

  it('preserves sibling keys inside the shell and startup tables', () => {
    const existing = '[shell]\ntimeout = 30\n\n[startup]\nbanner = false\n';
    const content = serializeDeepagentsConfig(makePermissions({ allow: ['Bash(ls:*)'] }), existing);
    expect(parseToml(content!)).toEqual({
      shell: { timeout: 30, allow_list: ['ls'] },
      startup: { banner: false, mode: 'manual' },
    });
  });

  it('replaces a previously generated allow_list instead of appending', () => {
    const existing = '[shell]\nallow_list = [ "old" ]\n\n[startup]\nmode = "yolo"\n';
    const content = serializeDeepagentsConfig(makePermissions({ allow: ['Bash(ls:*)'] }), existing);
    expect(parseToml(content!)).toEqual({
      shell: { allow_list: ['ls'] },
      startup: { mode: 'manual' },
    });
  });

  it('ignores malformed existing TOML rather than throwing', () => {
    const content = serializeDeepagentsConfig(makePermissions({ allow: ['Bash(ls:*)'] }), '[[[bad');
    expect(parseToml(content!)).toEqual({
      shell: { allow_list: ['ls'] },
      startup: { mode: 'manual' },
    });
  });

  it('handles an empty existing config.toml', () => {
    const content = serializeDeepagentsConfig(makePermissions({ allow: ['Bash(ls:*)'] }), '');
    expect(parseToml(content!)).toEqual({
      shell: { allow_list: ['ls'] },
      startup: { mode: 'manual' },
    });
  });
});

describe('parseDeepagentsPermissions', () => {
  it('maps a TOML array allow_list to canonical Bash(...) patterns', () => {
    const permissions = parseDeepagentsPermissions(
      '[shell]\nallow_list = [ "npm run test", "git status" ]\n',
    );
    expect(permissions).toEqual({
      allow: ['Bash(npm run test:*)', 'Bash(git status:*)'],
      deny: [],
    });
  });

  it('maps a comma-separated string allow_list', () => {
    const permissions = parseDeepagentsPermissions('[shell]\nallow_list = "ls, git status"\n');
    expect(permissions).toEqual({ allow: ['Bash(ls:*)', 'Bash(git status:*)'], deny: [] });
  });

  it('skips the recommended and all keywords', () => {
    const permissions = parseDeepagentsPermissions(
      '[shell]\nallow_list = [ "recommended", "ALL", "ls" ]\n',
    );
    expect(permissions).toEqual({ allow: ['Bash(ls:*)'], deny: [] });
  });

  it('dedupes repeated commands', () => {
    const permissions = parseDeepagentsPermissions('[shell]\nallow_list = [ "ls", "ls" ]\n');
    expect(permissions).toEqual({ allow: ['Bash(ls:*)'], deny: [] });
  });

  it('ignores non-string entries and blank commands', () => {
    const permissions = parseDeepagentsPermissions('[shell]\nallow_list = [ 42, "", "ls" ]\n');
    expect(permissions).toEqual({ allow: ['Bash(ls:*)'], deny: [] });
  });

  it('returns null when allow_list resolves to nothing', () => {
    expect(parseDeepagentsPermissions('[shell]\nallow_list = [ "all" ]\n')).toBeNull();
  });

  it('returns null when there is no shell table', () => {
    expect(parseDeepagentsPermissions('[startup]\nmode = "manual"\n')).toBeNull();
  });

  it('returns null when shell.allow_list is missing', () => {
    expect(parseDeepagentsPermissions('[shell]\ntimeout = 30\n')).toBeNull();
  });

  it('returns null for malformed TOML', () => {
    expect(parseDeepagentsPermissions('[[[bad')).toBeNull();
  });
});
