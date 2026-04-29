import { describe, expect, it } from 'vitest';
import {
  appendCodexRuleIndex,
  codexInstructionMirrorPath,
  serializeCodexInstructionMirror,
  stripCodexRuleIndex,
} from '../../../../src/targets/codex-cli/instruction-mirror.js';
import {
  CODEX_RULE_INDEX_END,
  CODEX_RULE_INDEX_START,
} from '../../../../src/targets/codex-cli/constants.js';
import type { CanonicalRule } from '../../../../src/core/types.js';

function makeRule(partial: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: '.agentsmesh/rules/typescript.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: 'rule body',
    ...partial,
  };
}

describe('codexInstructionMirrorPath', () => {
  it('derives slug from rule.source basename', () => {
    expect(codexInstructionMirrorPath(makeRule({ source: '.agentsmesh/rules/foo.md' }))).toBe(
      '.codex/instructions/foo.md',
    );
  });

  it('handles non-md sources by stripping `.md` only when present', () => {
    expect(codexInstructionMirrorPath(makeRule({ source: 'rules/bar' }))).toBe(
      '.codex/instructions/bar.md',
    );
  });
});

describe('serializeCodexInstructionMirror', () => {
  it('omits empty optional fields from frontmatter', () => {
    const out = serializeCodexInstructionMirror(makeRule({ root: false, body: 'B' }));
    expect(out).toMatch(/^---/);
    expect(out).not.toContain('description:');
    expect(out).not.toContain('globs:');
    expect(out).not.toContain('targets:');
    expect(out).not.toContain('codex_emit:');
    expect(out).not.toContain('codex_instruction:');
    expect(out).toContain('B');
  });

  it('includes optional fields when present', () => {
    const out = serializeCodexInstructionMirror(
      makeRule({
        root: true,
        description: 'My desc',
        globs: ['src/**/*.ts'],
        targets: ['codex-cli'],
        codexEmit: 'execution',
        codexInstructionVariant: 'override',
        body: 'body content',
      }),
    );
    expect(out).toContain('description: My desc');
    expect(out).toContain('codex_emit: execution');
    expect(out).toContain('codex_instruction: override');
    expect(out).toContain('targets:');
    expect(out).toContain('globs:');
  });

  it('omits codex_instruction when variant=default', () => {
    const out = serializeCodexInstructionMirror(makeRule({ codexInstructionVariant: 'default' }));
    expect(out).not.toContain('codex_instruction:');
  });

  it('uses empty body when body is whitespace-only', () => {
    const out = serializeCodexInstructionMirror(makeRule({ body: '   \n   ' }));
    expect(out).toContain('root: false');
    // body trimmed away — no extra non-frontmatter content
    const afterFrontmatter = out.split(/^---\n[\s\S]*?\n---\n/m)[1];
    expect(afterFrontmatter?.trim() ?? '').toBe('');
  });
});

describe('appendCodexRuleIndex', () => {
  it('returns trimmed root body when there are no non-root rules', () => {
    const body = '# Root\n\nSome text\n\n';
    expect(appendCodexRuleIndex(body, [makeRule({ root: true })])).toBe('# Root\n\nSome text');
  });

  it('appends index section with description-as-label entries when descriptions are set', () => {
    const out = appendCodexRuleIndex('# Root', [
      makeRule({ source: '.agentsmesh/rules/style.md', description: 'TS Style', globs: ['*.ts'] }),
    ]);
    expect(out).toContain(CODEX_RULE_INDEX_START);
    expect(out).toContain(CODEX_RULE_INDEX_END);
    expect(out).toContain('## Additional Rule Files');
    expect(out).toContain('[TS Style](.codex/instructions/style.md)');
    expect(out).toContain('Applies to `*.ts`.');
  });

  it('uses slug as label when description is missing', () => {
    const out = appendCodexRuleIndex('', [
      makeRule({ source: '.agentsmesh/rules/perf.md', description: '', globs: ['src/**'] }),
    ]);
    expect(out).toContain('[perf](.codex/instructions/perf.md)');
    // Empty trimmed root body: section is the entire output
    expect(out).toMatch(new RegExp(`^${CODEX_RULE_INDEX_START}`));
  });

  it('summary: marks root rules ("whole project")', () => {
    // root rule is filtered out, so we instead use a non-root with no globs and no targets
    const out = appendCodexRuleIndex('', [
      makeRule({ source: '.agentsmesh/rules/x.md', description: 'D', globs: [], root: false }),
    ]);
    expect(out).toContain('General guidance with no file glob restriction.');
  });

  it('summary: handles override variant', () => {
    const out = appendCodexRuleIndex('', [
      makeRule({
        source: '.agentsmesh/rules/o.md',
        description: 'O',
        codexInstructionVariant: 'override',
      }),
    ]);
    expect(out).toContain('Override guidance');
  });

  it('summary: handles execution emit', () => {
    const out = appendCodexRuleIndex('', [
      makeRule({
        source: '.agentsmesh/rules/e.md',
        description: 'E',
        codexEmit: 'execution',
      }),
    ]);
    expect(out).toContain('Enforced in `.codex/rules/e.rules`.');
  });

  it('summary: lists targets when present', () => {
    const out = appendCodexRuleIndex('', [
      makeRule({
        source: '.agentsmesh/rules/t.md',
        description: 'T',
        targets: ['codex-cli', 'cursor'],
      }),
    ]);
    expect(out).toContain('Targeted to `codex-cli`, `cursor`.');
  });
});

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
