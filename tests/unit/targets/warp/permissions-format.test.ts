import { describe, it, expect } from 'vitest';
import {
  buildWarpAgentProfile,
  profileToPermissions,
  unmappedPermissionEntries,
  regexInterpretedEntries,
} from '../../../../src/targets/warp/permissions-format.js';

describe('buildWarpAgentProfile', () => {
  it('maps allow/deny commands and read targets onto the documented keys', () => {
    expect(
      buildWarpAgentProfile({
        allow: ['Bash(git status:*)', 'Bash(ls)', 'Read(./src/**)'],
        deny: ['Bash(rm -rf:*)'],
        ask: ['Bash(git push:*)'],
      }),
    ).toEqual({
      agent_mode_command_execution_allowlist: ['^git status(\\s.*)?$', '^ls$'],
      agent_mode_command_execution_denylist: ['rm -rf(\\s.*)?'],
      agent_mode_coding_file_read_allowlist: ['./src/**'],
      agent_mode_coding_permissions: 'allow_reading_specific_files',
    });
  });

  it('keeps the payload verbatim so an imported user regex still matches', () => {
    expect(buildWarpAgentProfile({ allow: [], deny: ['Bash(rm -rf .*)'] })).toEqual({
      agent_mode_command_execution_allowlist: [],
      agent_mode_command_execution_denylist: ['rm -rf .*'],
    });
  });

  it('promotes a bare Read entry to always_allow_reading', () => {
    expect(buildWarpAgentProfile({ allow: ['Read', 'Read(./src/**)'], deny: [] })).toEqual({
      agent_mode_command_execution_allowlist: [],
      agent_mode_coding_file_read_allowlist: ['./src/**'],
      agent_mode_coding_permissions: 'always_allow_reading',
    });
  });

  it('de-duplicates commands that collapse to the same regex', () => {
    expect(buildWarpAgentProfile({ allow: ['Bash(ls)', 'Bash( ls )'], deny: [] })).toEqual({
      agent_mode_command_execution_allowlist: ['^ls$'],
    });
  });

  it('drops payloads that are not valid regexes rather than emitting a broken list', () => {
    expect(buildWarpAgentProfile({ allow: ['Bash(echo :-))'], deny: [] })).toEqual({
      agent_mode_command_execution_allowlist: [],
    });
  });

  it('always carries the owned allowlist key so revocations propagate', () => {
    expect(buildWarpAgentProfile({ allow: [], deny: [], ask: ['Bash(git push:*)'] })).toEqual({
      agent_mode_command_execution_allowlist: [],
    });
    expect(buildWarpAgentProfile({ allow: ['Bash', 'WebFetch'], deny: [] })).toEqual({
      agent_mode_command_execution_allowlist: [],
    });
  });

  it('returns null only when there are no canonical permissions at all', () => {
    expect(buildWarpAgentProfile(null)).toBeNull();
  });
});

describe('unmappedPermissionEntries', () => {
  it('names allow entries with no Warp key and every non-command deny entry', () => {
    expect(
      unmappedPermissionEntries({
        allow: ['Bash', 'Edit(src/**)', 'Bash(ls)', 'Read(./x)'],
        deny: ['Read(./.env)', 'Bash(rm:*)'],
        ask: ['Bash(git push:*)'],
      }),
    ).toEqual({ allow: ['Bash', 'Edit(src/**)'], deny: ['Read(./.env)'] });
  });

  it('names Bash entries whose payload is not a valid regex, because they are dropped', () => {
    expect(unmappedPermissionEntries({ allow: ['Bash(echo :-))'], deny: [] })).toEqual({
      allow: ['Bash(echo :-))'],
      deny: [],
    });
  });

  it('returns empty lists for null permissions', () => {
    expect(unmappedPermissionEntries(null)).toEqual({ allow: [], deny: [] });
  });
});

describe('regexInterpretedEntries', () => {
  it('names mapped command entries whose payload Warp reads as a pattern', () => {
    expect(
      regexInterpretedEntries({
        allow: ['Bash(node build.js:*)', 'Bash(ls)', 'Read(./src/**)'],
        deny: ['Bash(rm -rf .*)', 'Bash(rm -rf:*)'],
      }),
    ).toEqual({ allow: ['Bash(node build.js:*)'], deny: ['Bash(rm -rf .*)'] });
  });

  it('returns empty lists for null permissions', () => {
    expect(regexInterpretedEntries(null)).toEqual({ allow: [], deny: [] });
  });
});

describe('profileToPermissions', () => {
  it('inverts the owned keys and ignores everything else', () => {
    expect(
      profileToPermissions({
        agent_mode_execute_readonly_commands: true,
        agent_mode_command_execution_allowlist: ['^ls$', '^ls$'],
        agent_mode_command_execution_denylist: ['rm -rf .*'],
        agent_mode_coding_file_read_allowlist: ['./src/**'],
        agent_mode_coding_permissions: 'always_allow_reading',
      }),
    ).toEqual({
      allow: ['Bash(ls)', 'Read', 'Read(./src/**)'],
      deny: ['Bash(rm -rf .*)'],
    });
  });

  it('returns null when no owned key carries an entry', () => {
    expect(profileToPermissions({ agent_mode_execute_readonly_commands: true })).toBeNull();
  });
});
