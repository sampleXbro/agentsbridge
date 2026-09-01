import { describe, it, expect } from 'vitest';
import type { Permissions } from '../../../../src/core/types.js';
import {
  mapsToTraeKey,
  projectTraePermissions,
  traeToPermissions,
  unmappedPermissionEntries,
} from '../../../../src/targets/trae/permissions-format.js';

function perms(overrides: Partial<Permissions> = {}): Permissions {
  return { allow: [], deny: [], ask: [], ...overrides };
}

describe('projectTraePermissions', () => {
  it('maps Bash prefix patterns to the prefix command rules', () => {
    const { commandRules } = projectTraePermissions(
      perms({ allow: ['Bash(npm run test:*)'], deny: ['Bash(curl:*)'], ask: ['Bash(git push:*)'] }),
    );

    expect(commandRules.prefix).toEqual({
      'npm run test': { approval: 'allow' },
      curl: { approval: 'deny' },
      'git push': { approval: 'ask' },
    });
    expect(commandRules.exact).toEqual({});
  });

  it('maps a Bash pattern without a wildcard to the exact command rules', () => {
    const { commandRules } = projectTraePermissions(perms({ allow: ['Bash(git status)'] }));
    expect(commandRules.exact).toEqual({ 'git status': { approval: 'allow' } });
  });

  it('lets deny win over allow for the same command', () => {
    const { commandRules } = projectTraePermissions(
      perms({ allow: ['Bash(rm:*)'], ask: ['Bash(rm:*)'], deny: ['Bash(rm:*)'] }),
    );
    expect(commandRules.prefix).toEqual({ rm: { approval: 'deny' } });
  });

  it('maps allowed Read/Edit/Write paths onto filesystem authorization', () => {
    const { filesystem } = projectTraePermissions(
      perms({ allow: ['Read(./docs/**)', 'Edit(./src/**)', 'Write(./tmp)'] }),
    );
    expect(filesystem.readWrite).toEqual(['./src/**', './tmp']);
    expect(filesystem.readOnly).toEqual(['./docs/**']);
  });

  it('does not repeat a read-write path in the read-only list', () => {
    const { filesystem } = projectTraePermissions(perms({ allow: ['Read(./src)', 'Edit(./src)'] }));
    expect(filesystem.readWrite).toEqual(['./src']);
    expect(filesystem.readOnly).toEqual([]);
  });

  it('returns an empty projection for null permissions', () => {
    expect(projectTraePermissions(null)).toEqual({
      filesystem: { readWrite: [], readOnly: [] },
      commandRules: { exact: {}, prefix: {} },
    });
  });
});

describe('unmappedPermissionEntries', () => {
  it('names blanket tool toggles and denied file paths', () => {
    const unmapped = unmappedPermissionEntries(
      perms({
        allow: ['Read', 'Grep', 'Bash(npm test:*)', 'Read(./src)'],
        deny: ['WebFetch', 'Read(./.env)', 'Bash(curl:*)'],
        ask: ['Edit(./src)'],
      }),
    );

    expect(unmapped.allow).toEqual(['Read', 'Grep']);
    expect(unmapped.deny).toEqual(['WebFetch', 'Read(./.env)']);
    expect(unmapped.ask).toEqual(['Edit(./src)']);
  });

  it('is empty for null permissions', () => {
    expect(unmappedPermissionEntries(null)).toEqual({ allow: [], deny: [], ask: [] });
  });
});

describe('mapsToTraeKey', () => {
  it('accepts file patterns only on the allow list', () => {
    expect(mapsToTraeKey('Read(./src)', 'allow')).toBe(true);
    expect(mapsToTraeKey('Read(./src)', 'deny')).toBe(false);
    expect(mapsToTraeKey('Bash(rm:*)', 'deny')).toBe(true);
    expect(mapsToTraeKey('Bash()', 'allow')).toBe(false);
  });
});

describe('traeToPermissions', () => {
  it('reads command rules and filesystem authorization back into canonical form', () => {
    const permissions = traeToPermissions({
      customProfiles: {
        defaultCustomProfile: {
          approval: {
            commandRules: {
              exact: { 'git status': { approval: 'allow' } },
              prefix: { curl: { approval: 'deny' }, 'git push': { approval: 'ask' } },
            },
          },
        },
      },
      resourceAuthorization: {
        filesystem: { readWrite: ['./src/**'], readOnly: ['./docs/**'] },
      },
    });

    expect(permissions).toEqual({
      allow: ['Bash(git status)', 'Edit(./src/**)', 'Read(./docs/**)'],
      deny: ['Bash(curl:*)'],
      ask: ['Bash(git push:*)'],
    });
  });

  it('skips regex rules and wrongly typed entries', () => {
    expect(
      traeToPermissions({
        customProfiles: {
          defaultCustomProfile: {
            approval: {
              commandRules: {
                regex: { '^ls': { approval: 'allow' } },
                exact: { 'a b': { approval: 'maybe' }, ok: 'nope', '': { approval: 'allow' } },
              },
            },
          },
        },
        resourceAuthorization: { filesystem: { readOnly: [1, './x'] } },
      }),
    ).toEqual({ allow: ['Read(./x)'], deny: [], ask: [] });
  });

  it('returns null when the file expresses nothing agentsmesh owns', () => {
    expect(traeToPermissions({ customProfiles: {}, resourceAuthorization: {} })).toBeNull();
    expect(traeToPermissions('nope')).toBeNull();
  });
});
