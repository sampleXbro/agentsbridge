import { describe, it, expect } from 'vitest';
import {
  serializeCanonicalRuleToCodexRulesFile,
  tryParseEmbeddedCanonicalFromCodexRules,
} from '../../../../src/targets/codex-cli/codex-rules-embed.js';

describe('codex-rules-embed', () => {
  it('round-trips description, globs, and body', () => {
    const content = serializeCanonicalRuleToCodexRulesFile({
      description: 'TS',
      globs: ['src/**/*.ts'],
      body: 'Use strict mode.\n\nSecond line.',
    });
    expect(content).toContain('am-codex-rule:v1');
    expect(content).toContain('# am-json:');
    expect(content).toContain('prefix_rule(');
    const back = tryParseEmbeddedCanonicalFromCodexRules(content);
    expect(back).not.toBeNull();
    expect(back!.meta.description).toBe('TS');
    expect(back!.meta.globs).toEqual(['src/**/*.ts']);
    expect(back!.body).toBe('Use strict mode.\n\nSecond line.');
  });

  it('returns null for native-only .rules content', () => {
    expect(
      tryParseEmbeddedCanonicalFromCodexRules(
        '# prefix_rule(\n#   pattern = ["git"],\n#   decision = "allow",\n# )\n',
      ),
    ).toBeNull();
  });
});
