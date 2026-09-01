import { describe, it, expect } from 'vitest';
import {
  commandRegex,
  commandPattern,
  isRegexPayload,
} from '../../../../src/targets/warp/permissions-regex.js';

describe('commandRegex (W2: payloads are regexes, W8: allow entries are anchored)', () => {
  it('anchors allowlist entries so a bare command cannot match a longer line', () => {
    expect(commandRegex('Bash(ls)', 'allow')).toBe('^ls$');
    expect(new RegExp(commandRegex('Bash(ls)', 'allow')!).test('curl evil | ls')).toBe(false);
    expect(new RegExp(commandRegex('Bash(ls)', 'allow')!).test('ls')).toBe(true);
  });

  it('anchors the prefix form around the documented arguments suffix', () => {
    expect(commandRegex('Bash(git status:*)', 'allow')).toBe('^git status(\\s.*)?$');
    expect(new RegExp(commandRegex('Bash(git status:*)', 'allow')!).test('git status -sb')).toBe(
      true,
    );
  });

  it('leaves denylist entries unanchored, the wider reading of both semantics', () => {
    expect(commandRegex('Bash(rm -rf:*)', 'deny')).toBe('rm -rf(\\s.*)?');
    expect(commandRegex('Bash(rm -rf .*)', 'deny')).toBe('rm -rf .*');
  });

  it('passes the payload through verbatim instead of regex-escaping it', () => {
    expect(commandRegex('Bash(rm -rf .*)', 'deny')).toBe('rm -rf .*');
    expect(new RegExp(commandRegex('Bash(rm -rf .*)', 'deny')!).test('rm -rf /')).toBe(true);
  });

  it('returns null for non-command patterns and for payloads that are invalid regexes', () => {
    expect(commandRegex('Read(./src/**)', 'allow')).toBeNull();
    expect(commandRegex('Bash', 'allow')).toBeNull();
    expect(commandRegex('Bash()', 'allow')).toBeNull();
    expect(commandRegex('Bash(echo :-))', 'deny')).toBeNull();
  });
});

describe('commandPattern', () => {
  it('strips the anchors agentsmesh adds to allowlist entries', () => {
    expect(commandPattern('^git status(\\s.*)?$', 'allow')).toBe('Bash(git status:*)');
    expect(commandPattern('^ls$', 'allow')).toBe('Bash(ls)');
  });

  it('keeps denylist entries verbatim so a user regex round-trips byte for byte', () => {
    expect(commandPattern('rm -rf .*', 'deny')).toBe('Bash(rm -rf .*)');
    expect(commandPattern('^curl$', 'deny')).toBe('Bash(^curl$)');
  });

  it('normalizes an unanchored allow entry, never widening it', () => {
    expect(commandPattern('curl(\\s.*)?', 'allow')).toBe('Bash(curl:*)');
    expect(commandRegex('Bash(curl:*)', 'allow')).toBe('^curl(\\s.*)?$');
  });

  it('returns null for regexes with no command body', () => {
    expect(commandPattern('^$', 'allow')).toBeNull();
    expect(commandPattern('   ', 'deny')).toBeNull();
    expect(commandPattern('^(\\s.*)?$', 'allow')).toBeNull();
  });
});

describe('isRegexPayload', () => {
  it('flags payloads Warp reads as patterns rather than literal commands', () => {
    expect(isRegexPayload('Bash(rm -rf .*)')).toBe(true);
    expect(isRegexPayload('Bash(node build.js:*)')).toBe(true);
    expect(isRegexPayload('Bash(git status:*)')).toBe(false);
    expect(isRegexPayload('Bash(ls)')).toBe(false);
    expect(isRegexPayload('Read(./src/**)')).toBe(false);
  });
});
