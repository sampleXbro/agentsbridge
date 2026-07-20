import { describe, it, expect } from 'vitest';
import { buildToolPermissions } from '../../../../src/targets/rovodev/permissions.js';

describe('buildToolPermissions (rovodev)', () => {
  it('returns null when there are no permission entries', () => {
    expect(buildToolPermissions({ allow: [], deny: [], ask: [] })).toBeNull();
  });

  it('maps plain tool-name patterns to tools.<name>', () => {
    const result = buildToolPermissions({ allow: ['Read', 'Grep'], deny: ['WebFetch'] });
    expect(result).toEqual({
      tools: { Read: 'allow', Grep: 'allow', WebFetch: 'deny' },
    });
  });

  it('maps parameterized non-bash patterns to tools.<pattern> verbatim', () => {
    const result = buildToolPermissions({ allow: [], deny: ['Read(./.env)'] });
    expect(result).toEqual({ tools: { 'Read(./.env)': 'deny' } });
  });

  it('falls back to a verbatim tools.<pattern> entry when "Bash(...)" has no command left after trimming', () => {
    const result = buildToolPermissions({ allow: [], deny: ['Bash()'] });
    expect(result).toEqual({ tools: { 'Bash()': 'deny' } });
  });

  it('maps a bare "Bash" pattern to tools.bash.default', () => {
    const result = buildToolPermissions({ allow: [], deny: ['Bash'] });
    expect(result).toEqual({ tools: { bash: { default: 'deny' } } });
  });

  it('maps "Bash(<command>)" patterns to tools.bash.commands', () => {
    const result = buildToolPermissions({ allow: ['Bash(npm run test:*)'], deny: [] });
    expect(result).toEqual({
      tools: { bash: { commands: [{ command: 'npm run test', permission: 'allow' }] } },
    });
  });

  it('strips a trailing ":*" wildcard suffix from bash command patterns', () => {
    const result = buildToolPermissions({ allow: [], deny: [], ask: ['Bash(git diff:*)'] });
    expect(result).toEqual({
      tools: { bash: { commands: [{ command: 'git diff', permission: 'ask' }] } },
    });
  });

  it('preserves a bash command pattern with no wildcard suffix as-is', () => {
    const result = buildToolPermissions({ allow: ['Bash(git diff)'], deny: [] });
    expect(result).toEqual({
      tools: { bash: { commands: [{ command: 'git diff', permission: 'allow' }] } },
    });
  });

  it('combines bash default and bash commands in one sub-table', () => {
    const result = buildToolPermissions({
      allow: [],
      deny: ['Bash'],
      ask: ['Bash(git push:*)'],
    });
    expect(result).toEqual({
      tools: {
        bash: {
          default: 'deny',
          commands: [{ command: 'git push', permission: 'ask' }],
        },
      },
    });
  });

  it('collects multiple bash command patterns across allow/deny/ask', () => {
    const result = buildToolPermissions({
      allow: ['Bash(ls:*)'],
      deny: ['Bash(rm -rf:*)'],
      ask: ['Bash(git push:*)'],
    });
    expect(result).toEqual({
      tools: {
        bash: {
          commands: [
            { command: 'ls', permission: 'allow' },
            { command: 'git push', permission: 'ask' },
            { command: 'rm -rf', permission: 'deny' },
          ],
        },
      },
    });
  });

  it('mixes plain tool names and bash rules in the same tools table', () => {
    const result = buildToolPermissions({
      allow: ['Read', 'Bash(git diff:*)'],
      deny: ['WebFetch'],
    });
    expect(result).toEqual({
      tools: {
        Read: 'allow',
        WebFetch: 'deny',
        bash: { commands: [{ command: 'git diff', permission: 'allow' }] },
      },
    });
  });

  it('treats a pattern that only trims to "Bash" (with surrounding whitespace) as the bare default', () => {
    const result = buildToolPermissions({ allow: [' Bash '], deny: [] });
    expect(result).toEqual({ tools: { bash: { default: 'allow' } } });
  });
});
