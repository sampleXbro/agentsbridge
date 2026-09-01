/**
 * Regressions for `~/.trae/permission/global.json`.
 *
 * Trae writes this file itself: folder grants land in
 * `resourceAuthorization.filesystem`, "Add to allowlist" lands in
 * `approval.commandRules`. agentsmesh therefore adds to it and never rewrites
 * or deletes what it finds.
 */

import { describe, it, expect } from 'vitest';
import type { Permissions } from '../../../../src/core/types.js';
import { serializeTraePermissions } from '../../../../src/targets/trae/permissions-file.js';

interface TraeFile {
  customProfiles?: Record<string, Record<string, unknown>>;
  resourceAuthorization?: { filesystem?: { readWrite?: string[]; readOnly?: string[] } };
}

function parse(content: string | null): TraeFile {
  expect(content).not.toBeNull();
  return JSON.parse(content!) as TraeFile;
}

function commandRules(file: TraeFile): Record<string, Record<string, unknown>> {
  const profile = file.customProfiles?.defaultCustomProfile ?? {};
  const approval = (profile.approval ?? {}) as Record<string, unknown>;
  return (approval.commandRules ?? {}) as Record<string, Record<string, unknown>>;
}

const GRANTED = JSON.stringify({
  resourceAuthorization: {
    filesystem: { readWrite: ['/Users/me/projects/important'], readOnly: ['/Users/me/notes'] },
  },
});

describe('serializeTraePermissions never destroys IDE-written state', () => {
  it('leaves the file alone when there is no canonical permissions.yaml', () => {
    expect(serializeTraePermissions(null, GRANTED)).toBeNull();
  });

  it('keeps folder grants that canonical does not mention', () => {
    const permissions: Permissions = { allow: ['Bash(git status:*)'], deny: [] };
    const file = parse(serializeTraePermissions(permissions, GRANTED));
    expect(file.resourceAuthorization?.filesystem?.readWrite).toEqual([
      '/Users/me/projects/important',
    ]);
    expect(file.resourceAuthorization?.filesystem?.readOnly).toEqual(['/Users/me/notes']);
  });

  it('keeps hand-written command rules in a bucket canonical does not fill', () => {
    const existing = JSON.stringify({
      customProfiles: {
        defaultCustomProfile: {
          approval: { commandRules: { exact: { 'my own cmd': { approval: 'allow' } } } },
        },
      },
    });
    const permissions: Permissions = { allow: ['Bash(git status:*)'], deny: [] };
    const rules = commandRules(parse(serializeTraePermissions(permissions, existing)));
    expect(rules.exact).toEqual({ 'my own cmd': { approval: 'allow' } });
    expect(rules.prefix).toEqual({ 'git status': { approval: 'allow' } });
  });

  it('does not invent sandbox, scene or default-policy keys in a file that had none', () => {
    const permissions: Permissions = { allow: ['Bash(git status:*)'], deny: [] };
    const file = parse(serializeTraePermissions(permissions, null));
    const profile = file.customProfiles!.defaultCustomProfile!;
    expect(Object.keys(profile)).toEqual(['approval']);
    expect(Object.keys(profile.approval as Record<string, unknown>)).toEqual(['commandRules']);
    expect(Object.keys(file.resourceAuthorization!)).toEqual(['filesystem']);
    expect(file.resourceAuthorization!.filesystem).toEqual({ readWrite: [], readOnly: [] });
    expect(Object.keys(commandRules(file))).toEqual(['prefix']);
  });

  it('adds canonical paths next to the paths already authorized in Trae', () => {
    const permissions: Permissions = { allow: ['Edit(./src)', 'Read(./docs)'], deny: [] };
    const file = parse(serializeTraePermissions(permissions, GRANTED));
    expect(file.resourceAuthorization?.filesystem?.readWrite).toEqual([
      '/Users/me/projects/important',
      './src',
    ]);
    expect(file.resourceAuthorization?.filesystem?.readOnly).toEqual(['/Users/me/notes', './docs']);
  });

  it('starts from a fresh document when the existing file is unparsable', () => {
    const permissions: Permissions = { allow: ['Bash(ls)'], deny: [] };
    const file = parse(serializeTraePermissions(permissions, '{ not json'));
    expect(commandRules(file).exact).toEqual({ ls: { approval: 'allow' } });
  });

  it('returns null when canonical grants nothing Trae can express', () => {
    expect(serializeTraePermissions({ allow: ['Grep'], deny: [] }, GRANTED)).toBeNull();
  });
});
