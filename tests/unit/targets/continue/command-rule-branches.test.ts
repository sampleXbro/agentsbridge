/**
 * Branch coverage tests for src/targets/continue/command-rule.ts.
 * Targets toStringArray (array vs string vs other), serializeCommandRule
 * pruning when description/allowedTools empty, parseCommandRuleFrontmatter
 * fileName fallback when x-agentsmesh-name is empty string vs missing vs
 * non-string, and serializeImportedCommand pruning branches.
 */
import { describe, it, expect } from 'vitest';
import {
  continueCommandRulePath,
  parseCommandRuleFrontmatter,
  serializeCommandRule,
  serializeImportedCommand,
} from '../../../../src/targets/continue/command-rule.js';
import type { CanonicalCommand } from '../../../../src/core/types.js';

function makeCommand(overrides: Partial<CanonicalCommand> = {}): CanonicalCommand {
  return {
    source: '.agentsmesh/commands/review.md',
    name: 'review',
    description: '',
    allowedTools: [],
    body: 'Review the diff.',
    ...overrides,
  };
}

describe('continueCommandRulePath', () => {
  it('builds .continue/prompts/<name>.md', () => {
    expect(continueCommandRulePath('deploy')).toBe('.continue/prompts/deploy.md');
  });
});

describe('serializeCommandRule — pruning branches', () => {
  it('omits description and allowed-tools when both empty', () => {
    const out = serializeCommandRule(makeCommand({ description: '', allowedTools: [] }));
    expect(out).not.toContain('description:');
    expect(out).not.toContain('x-agentsmesh-allowed-tools:');
    // x-agentsmesh-kind/name still present
    expect(out).toContain('x-agentsmesh-kind: command');
    expect(out).toContain('x-agentsmesh-name: review');
  });

  it('keeps description when populated', () => {
    const out = serializeCommandRule(makeCommand({ description: 'Review code', allowedTools: [] }));
    expect(out).toContain('description: Review code');
    expect(out).not.toContain('x-agentsmesh-allowed-tools:');
  });

  it('keeps allowed-tools array when non-empty', () => {
    const out = serializeCommandRule(
      makeCommand({ description: '', allowedTools: ['Read', 'Bash'] }),
    );
    expect(out).toContain('x-agentsmesh-allowed-tools:');
    expect(out).toContain('Read');
    expect(out).toContain('Bash');
  });

  it('handles whitespace-only body via trim() || "" fallback', () => {
    const out = serializeCommandRule(makeCommand({ body: '   \n\n   ' }));
    // serialized output ends with frontmatter close; body is empty
    expect(out).toContain('x-agentsmesh-kind: command');
  });
});

describe('parseCommandRuleFrontmatter — name fallback branches', () => {
  it('uses x-agentsmesh-name when set to a non-empty string', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-name': 'custom-name' },
      '.continue/prompts/file-name.md',
    );
    expect(parsed.name).toBe('custom-name');
  });

  it('falls back to filename when x-agentsmesh-name is empty string', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-name': '' },
      '.continue/prompts/file-name.md',
    );
    expect(parsed.name).toBe('file-name');
  });

  it('falls back to filename when x-agentsmesh-name is missing', () => {
    const parsed = parseCommandRuleFrontmatter({}, '.continue/prompts/file-name.md');
    expect(parsed.name).toBe('file-name');
  });

  it('falls back to filename when x-agentsmesh-name is non-string (e.g. number)', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-name': 42 },
      '.continue/prompts/file-name.md',
    );
    expect(parsed.name).toBe('file-name');
  });

  it('returns empty description when frontmatter.description is non-string', () => {
    const parsed = parseCommandRuleFrontmatter({ description: 99 }, '.continue/prompts/x.md');
    expect(parsed.description).toBe('');
  });
});

describe('parseCommandRuleFrontmatter — toStringArray branches', () => {
  it('parses array of strings, dropping empty entries', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-allowed-tools': ['Read', '', 'Bash'] },
      '.continue/prompts/x.md',
    );
    expect(parsed.allowedTools).toEqual(['Read', 'Bash']);
  });

  it('parses comma-separated string, trimming and dropping blanks', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-allowed-tools': 'Read , Bash , ' },
      '.continue/prompts/x.md',
    );
    expect(parsed.allowedTools).toEqual(['Read', 'Bash']);
  });

  it('returns [] for non-array, non-string allowedTools (e.g. number)', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-allowed-tools': 5 },
      '.continue/prompts/x.md',
    );
    expect(parsed.allowedTools).toEqual([]);
  });

  it('returns [] for empty string allowedTools', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-allowed-tools': '' },
      '.continue/prompts/x.md',
    );
    expect(parsed.allowedTools).toEqual([]);
  });

  it('drops non-string entries when array contains mixed types', () => {
    const parsed = parseCommandRuleFrontmatter(
      { 'x-agentsmesh-allowed-tools': ['Read', 1, null, 'Bash'] },
      '.continue/prompts/x.md',
    );
    expect(parsed.allowedTools).toEqual(['Read', 'Bash']);
  });
});

describe('serializeImportedCommand — pruning branches', () => {
  it('omits both keys when description and allowedTools are empty', () => {
    const out = serializeImportedCommand({ name: 'r', description: '', allowedTools: [] }, 'body');
    expect(out).not.toContain('description:');
    expect(out).not.toContain('allowed-tools:');
    expect(out).toContain('body');
  });

  it('keeps description and allowed-tools when both populated', () => {
    const out = serializeImportedCommand(
      { name: 'r', description: 'd', allowedTools: ['Read'] },
      'body',
    );
    expect(out).toContain('description: d');
    expect(out).toContain('allowed-tools:');
    expect(out).toContain('Read');
  });

  it('handles whitespace-only body via trim() || "" fallback', () => {
    const out = serializeImportedCommand({ name: 'r', description: '', allowedTools: [] }, '   ');
    expect(typeof out).toBe('string');
  });
});
