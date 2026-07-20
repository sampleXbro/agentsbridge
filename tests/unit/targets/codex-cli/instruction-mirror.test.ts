import { describe, expect, it } from 'vitest';
import { stripCodexRuleIndex } from '../../../../src/targets/codex-cli/instruction-mirror.js';
import {
  CODEX_RULE_INDEX_END,
  CODEX_RULE_INDEX_START,
} from '../../../../src/targets/codex-cli/constants.js';

describe('stripCodexRuleIndex', () => {
  it('strips the index section', () => {
    const content = `# Root\n\n${CODEX_RULE_INDEX_START}\nstuff\n${CODEX_RULE_INDEX_END}\n\nMore`;
    expect(stripCodexRuleIndex(content)).toContain('# Root');
    expect(stripCodexRuleIndex(content)).toContain('More');
    expect(stripCodexRuleIndex(content)).not.toContain('agentsmesh:codex-rule-index');
  });

  it('returns content unchanged (trimmed) when no index present', () => {
    expect(stripCodexRuleIndex('# Root\n\n')).toBe('# Root');
  });
});
