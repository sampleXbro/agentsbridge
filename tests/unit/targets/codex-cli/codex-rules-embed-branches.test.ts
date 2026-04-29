/**
 * Branch coverage tests for codex-rules-embed.ts.
 * Targets the `??` fallbacks for missing description/globs (lines 28-29),
 * the `||` empty-default branches in tryParseEmbeddedCanonicalFromCodexRules,
 * and the base64 / JSON failure paths (lines 65, 72, 74-75, 94).
 */

import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  serializeCanonicalRuleToCodexRulesFile,
  tryParseEmbeddedCanonicalFromCodexRules,
} from '../../../../src/targets/codex-cli/codex-rules-embed.js';
import {
  CODEX_RULE_EMBED_MARKER,
  CODEX_RULE_EMBED_JSON_PREFIX,
  CODEX_RULE_EMBED_B64_BEGIN,
  CODEX_RULE_EMBED_B64_END,
  CODEX_RULE_EMBED_B64_LINE,
} from '../../../../src/targets/codex-cli/constants.js';

describe('serializeCanonicalRuleToCodexRulesFile — defaulting branches', () => {
  it('uses empty defaults when description and globs are absent on the input object', () => {
    // The signature requires the fields, but the production code uses `?? ''` and
    // `?? []`, so passing nullish values (cast as the expected type) exercises both
    // short-circuit branches at lines 28-29.
    const rule = {
      description: undefined as unknown as string,
      globs: undefined as unknown as string[],
      body: 'Body text',
    };
    const out = serializeCanonicalRuleToCodexRulesFile(rule);
    expect(out).toContain(CODEX_RULE_EMBED_MARKER);
    expect(out).toContain(`${CODEX_RULE_EMBED_JSON_PREFIX}{"description":"","globs":[]}`);
    const parsed = tryParseEmbeddedCanonicalFromCodexRules(out);
    expect(parsed).not.toBeNull();
    expect(parsed!.meta).toEqual({ description: '', globs: [] });
    expect(parsed!.body).toBe('Body text');
  });

  it('produces multiple base64 lines for bodies longer than 76 chars (slice loop)', () => {
    const longBody = 'x'.repeat(500);
    const out = serializeCanonicalRuleToCodexRulesFile({
      description: 'd',
      globs: ['a'],
      body: longBody,
    });
    const b64Lines = out.split('\n').filter((l) => l.startsWith(CODEX_RULE_EMBED_B64_LINE));
    expect(b64Lines.length).toBeGreaterThan(1);
  });
});

describe('tryParseEmbeddedCanonicalFromCodexRules — early-return branches', () => {
  it('returns null when content lacks the embed marker', () => {
    expect(tryParseEmbeddedCanonicalFromCodexRules('# nothing here\n')).toBeNull();
  });

  it('returns null when marker is present but JSON line is missing', () => {
    const content = `# ${CODEX_RULE_EMBED_MARKER}\n# other line\n`;
    expect(tryParseEmbeddedCanonicalFromCodexRules(content)).toBeNull();
  });

  it('returns null when JSON line cannot be parsed', () => {
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n${CODEX_RULE_EMBED_JSON_PREFIX}{not json\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}aGk=\n${CODEX_RULE_EMBED_B64_END}\n`;
    expect(tryParseEmbeddedCanonicalFromCodexRules(content)).toBeNull();
  });

  it('returns null when JSON parses to a non-object (number)', () => {
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n${CODEX_RULE_EMBED_JSON_PREFIX}42\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}aGk=\n${CODEX_RULE_EMBED_B64_END}\n`;
    expect(tryParseEmbeddedCanonicalFromCodexRules(content)).toBeNull();
  });

  it('returns null when JSON parses to null', () => {
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n${CODEX_RULE_EMBED_JSON_PREFIX}null\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}aGk=\n${CODEX_RULE_EMBED_B64_END}\n`;
    expect(tryParseEmbeddedCanonicalFromCodexRules(content)).toBeNull();
  });

  it('returns null when no base64 chunks were collected (no body)', () => {
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n${CODEX_RULE_EMBED_JSON_PREFIX}{"description":"d","globs":["x"]}\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_END}\n`;
    expect(tryParseEmbeddedCanonicalFromCodexRules(content)).toBeNull();
  });

  it('falls back to empty description/globs when JSON object lacks those keys', () => {
    const body = Buffer.from('hello', 'utf8').toString('base64');
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n${CODEX_RULE_EMBED_JSON_PREFIX}{}\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}${body}\n${CODEX_RULE_EMBED_B64_END}\n`;
    const parsed = tryParseEmbeddedCanonicalFromCodexRules(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.meta.description).toBe('');
    expect(parsed!.meta.globs).toEqual([]);
    expect(parsed!.body).toBe('hello');
  });

  it('filters non-string entries out of globs array', () => {
    const body = Buffer.from('body', 'utf8').toString('base64');
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n` +
      `${CODEX_RULE_EMBED_JSON_PREFIX}{"description":42,"globs":["good",1,null,"alsoGood"]}\n` +
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}${body}\n${CODEX_RULE_EMBED_B64_END}\n`;
    const parsed = tryParseEmbeddedCanonicalFromCodexRules(content);
    expect(parsed).not.toBeNull();
    // description was a number → fallback to ''
    expect(parsed!.meta.description).toBe('');
    expect(parsed!.meta.globs).toEqual(['good', 'alsoGood']);
  });

  it('ignores base64 lines that appear outside the begin/end fence', () => {
    const body = Buffer.from('inside', 'utf8').toString('base64');
    // A `# am64:` line before the begin marker must be ignored.
    const content =
      `# ${CODEX_RULE_EMBED_MARKER}\n` +
      `${CODEX_RULE_EMBED_JSON_PREFIX}{"description":"d","globs":[]}\n` +
      `${CODEX_RULE_EMBED_B64_LINE}AAAA\n` + // outside fence — ignored
      `${CODEX_RULE_EMBED_B64_BEGIN}\n${CODEX_RULE_EMBED_B64_LINE}${body}\n${CODEX_RULE_EMBED_B64_END}\n`;
    const parsed = tryParseEmbeddedCanonicalFromCodexRules(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.body).toBe('inside');
  });
});
