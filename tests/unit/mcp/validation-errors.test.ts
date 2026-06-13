import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { enrichValidationIssues, nearestKey } from '../../../src/mcp/validation-errors.js';

const schema = z
  .object({
    file: z.string().optional(),
    command: z.string().optional(),
    keyword: z.string().optional(),
    max_tokens: z.number().optional(),
  })
  .strict();

function issuesFor(input: unknown): readonly z.core.$ZodIssue[] {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error('expected a validation failure');
  return parsed.error.issues;
}

describe('enrichValidationIssues', () => {
  it('lists the allowed keys for an unrecognized-key rejection', () => {
    const [issue] = enrichValidationIssues(schema, issuesFor({ bogus: 1 }));
    expect(issue?.expected).toEqual(['file', 'command', 'keyword', 'max_tokens']);
    expect(issue?.message).toContain('Expected one of: file, command, keyword, max_tokens');
  });

  it('suggests the nearest valid key for a typo', () => {
    const [issue] = enrichValidationIssues(schema, issuesFor({ comand: 'x' }));
    expect(issue?.suggestion).toBe('command');
    expect(issue?.message).toContain('Did you mean "command"?');
  });

  it('suggests a substring match (tokens -> max_tokens)', () => {
    const [issue] = enrichValidationIssues(schema, issuesFor({ tokens: 1 }));
    expect(issue?.suggestion).toBe('max_tokens');
  });

  it('passes through non-unrecognized-key issues unchanged (no bogus expected list)', () => {
    const [issue] = enrichValidationIssues(schema, issuesFor({ file: 123 }));
    expect(issue?.expected).toBeUndefined();
    expect(issue?.suggestion).toBeUndefined();
    expect(issue?.code).toBe('invalid_type');
  });

  it('emits an allowed list with no suggestion when nothing is close', () => {
    const [issue] = enrichValidationIssues(schema, issuesFor({ zzzzzzzz: 1 }));
    expect(issue?.expected).toEqual(['file', 'command', 'keyword', 'max_tokens']);
    expect(issue?.suggestion).toBeUndefined();
    expect(issue?.message).not.toContain('Did you mean');
  });

  it('yields an empty allowed list (and no enrichment) for a non-object schema', () => {
    const strSchema = z.string();
    const enriched = enrichValidationIssues(strSchema, [
      { code: 'unrecognized_keys', path: [], message: 'Unrecognized key', keys: ['x'] },
    ]);
    expect(enriched[0]?.expected).toBeUndefined();
    expect(enriched[0]?.message).toBe('Unrecognized key');
  });

  it('lists allowed keys without a suggestion when the issue carries no rejected keys', () => {
    const [issue] = enrichValidationIssues(schema, [
      { code: 'unrecognized_keys', path: [], message: 'Unrecognized key' },
    ]);
    expect(issue?.expected).toEqual(['file', 'command', 'keyword', 'max_tokens']);
    expect(issue?.suggestion).toBeUndefined();
    expect(issue?.message).not.toContain('Did you mean');
  });

  it('stringifies a symbol path segment instead of dropping it', () => {
    const sym = Symbol('weird');
    const [issue] = enrichValidationIssues(schema, [
      { code: 'custom', path: [sym, 0], message: 'odd path' },
    ]);
    expect(issue?.path).toEqual([sym.toString(), 0]);
  });
});

describe('nearestKey', () => {
  const keys = ['file', 'command', 'keyword', 'max_tokens', 'verbose'];

  it('matches case-insensitively and returns the canonical key', () => {
    expect(nearestKey('Command', keys)).toBe('command');
  });

  it('returns undefined when no candidate is close enough', () => {
    expect(nearestKey('xyz', keys)).toBeUndefined();
  });

  it('resolves a single-edit typo', () => {
    expect(nearestKey('keywrod', keys)).toBe('keyword');
  });

  it('picks the shortest substring match when several candidates contain the input', () => {
    // Neither candidate is within edit-distance range of "token", so the
    // substring fallback runs and sorts the matches by length.
    expect(nearestKey('token', ['token_budget', 'max_tokens', 'unrelated'])).toBe('max_tokens');
  });
});
