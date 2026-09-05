import { describe, it, expect } from 'vitest';
import {
  decodeLinkPath,
  encodeLinkPath,
} from '../../../../src/core/reference/link-uri-encoding.js';
import { rewriteFileLinks } from '../../../../src/core/reference/link-rebaser.js';

describe('decodeLinkPath / encodeLinkPath', () => {
  it('decodes only markdown link destinations that carry escapes', () => {
    expect(decodeLinkPath('a/my%20ref.md', 'markdown-link-dest')).toBe('a/my ref.md');
    expect(decodeLinkPath('a/my%20ref.md', 'prose')).toBe('a/my%20ref.md');
    expect(decodeLinkPath('a/plain.md', 'markdown-link-dest')).toBe('a/plain.md');
    expect(decodeLinkPath('a/bad%zz.md', 'markdown-link-dest')).toBe('a/bad%zz.md');
  });

  it('re-encodes each segment but leaves dot segments alone', () => {
    expect(encodeLinkPath('../skills/demo/my ref.md', true)).toBe('../skills/demo/my%20ref.md');
    expect(encodeLinkPath('../skills/demo/my ref.md', false)).toBe('../skills/demo/my ref.md');
  });
});

describe('rewriteFileLinks with a percent-encoded destination', () => {
  const root = '/proj';
  const files = new Set([
    '/proj/.agentsmesh/skills/demo/SKILL.md',
    '/proj/.agentsmesh/skills/demo/my ref.md',
    '/proj/.claude/skills/demo/SKILL.md',
    '/proj/.claude/skills/demo/my ref.md',
  ]);
  const translatePath = (abs: string): string => abs.replace('/.agentsmesh/', '/.claude/');

  it('rewrites the encoded link like its plain sibling and keeps it encoded', () => {
    const { content, missing } = rewriteFileLinks({
      content:
        '[ref](.agentsmesh/skills/demo/my%20ref.md) and [s](.agentsmesh/skills/demo/SKILL.md)',
      projectRoot: root,
      sourceFile: '/proj/.agentsmesh/rules/a.md',
      destinationFile: '/proj/.claude/rules/a.md',
      translatePath,
      pathExists: (p) => files.has(p),
      explicitCurrentDirLinks: true,
    });
    expect(missing).toEqual([]);
    expect(content).toBe('[ref](../skills/demo/my%20ref.md) and [s](../skills/demo/SKILL.md)');
  });
});
