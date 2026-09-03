import { describe, expect, it } from 'vitest';
import {
  GEMINI_POLICY_MARKER,
  mergeGeminiPolicies,
  mergeGeminiPolicyRules,
  splitPolicyBlocks,
} from '../../../../src/targets/gemini-cli/policies-merge.js';
import { GEMINI_GLOBAL_POLICIES_FILE } from '../../../../src/targets/gemini-cli/constants.js';

const GENERATED = [
  GEMINI_POLICY_MARKER,
  '[[rule]]',
  'decision = "allow"',
  'priority = 100',
  'toolName = "read_file"',
  '',
].join('\n');

const USER_RULE = [
  '[[rule]]',
  'decision = "ask_user"',
  'priority = 5',
  'toolName = "write_file"',
  '',
].join('\n');

describe('splitPolicyBlocks', () => {
  it('reports the whole file as header when it holds no rule', () => {
    expect(splitPolicyBlocks('# nothing here\n')).toEqual({
      header: '# nothing here\n',
      blocks: [],
    });
  });

  it('attaches the comment lines above a header to that block', () => {
    const { header, blocks } = splitPolicyBlocks(`# top\n\n${USER_RULE}${GENERATED}`);
    expect(header).toBe('# top\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toContain(GEMINI_POLICY_MARKER);
  });
});

describe('mergeGeminiPolicies', () => {
  it('returns the generated content when there is no base', () => {
    expect(mergeGeminiPolicies(null, GENERATED)).toBe(GENERATED);
    expect(mergeGeminiPolicies('  \n', GENERATED)).toBe(GENERATED);
  });

  it('keeps a hand-written rule and appends this run of generated rules', () => {
    expect(mergeGeminiPolicies(USER_RULE, GENERATED)).toBe(
      `${USER_RULE.trim()}\n\n${GENERATED.trim()}\n`,
    );
  });

  it('replaces the marked rules of a previous run instead of duplicating them', () => {
    const previous = [
      GEMINI_POLICY_MARKER,
      '[[rule]]',
      'decision = "deny"',
      'priority = 200',
      'toolName = "run_shell_command"',
      '',
    ].join('\n');
    const merged = mergeGeminiPolicies(previous, GENERATED);
    expect(merged).not.toContain('run_shell_command');
    expect(merged).toBe(`${GENERATED.trim()}\n`);
  });

  it('drops an unmarked block identical to a generated one, so an upgrade does not duplicate', () => {
    const unmarkedSameRule = GENERATED.split('\n').slice(1).join('\n');
    expect(mergeGeminiPolicies(unmarkedSameRule, GENERATED)).toBe(`${GENERATED.trim()}\n`);
  });

  it('keeps a leading file header above every rule', () => {
    expect(mergeGeminiPolicies(`# my policies\n\n${USER_RULE}`, GENERATED)).toBe(
      `# my policies\n\n${USER_RULE.trim()}\n\n${GENERATED.trim()}\n`,
    );
  });
});

describe('mergeGeminiPolicyRules', () => {
  it('declines a path it does not own', () => {
    expect(
      mergeGeminiPolicyRules(USER_RULE, undefined, GENERATED, '.gemini/settings.json'),
    ).toBeNull();
  });

  it('claims the global policies file', () => {
    expect(
      mergeGeminiPolicyRules(USER_RULE, undefined, GENERATED, GEMINI_GLOBAL_POLICIES_FILE),
    ).toContain('write_file');
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending = { content: USER_RULE };
    expect(mergeGeminiPolicyRules('', pending, GENERATED, GEMINI_GLOBAL_POLICIES_FILE)).toBe(
      `${USER_RULE.trim()}\n\n${GENERATED.trim()}\n`,
    );
  });
});
