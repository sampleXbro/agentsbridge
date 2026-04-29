import { describe, expect, it } from 'vitest';
import type { CanonicalRule } from '../../../../src/core/types.js';
import {
  appendEmbeddedRulesBlock,
  EMBEDDED_RULE_END,
  EMBEDDED_RULES_END,
  EMBEDDED_RULES_START,
  extractEmbeddedRules,
  renderEmbeddedRulesBlock,
  replaceManagedBlock,
  ROOT_CONTRACT_END,
  ROOT_CONTRACT_START,
  stripManagedBlock,
} from '../../../../src/targets/projection/managed-blocks.js';
import {
  AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
  appendAgentsmeshRootInstructionParagraph,
  stripAgentsmeshRootInstructionParagraph,
} from '../../../../src/targets/projection/root-instruction-paragraph.js';

const START = '<!-- agentsmesh:test:start -->';
const END = '<!-- agentsmesh:test:end -->';
const BLOCK = `${START}\nbody\n${END}`;

function makeRule(overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: '.agentsmesh/rules/example.md',
    root: false,
    targets: [],
    description: 'Example rule',
    globs: [],
    body: 'Rule body content.',
    ...overrides,
  };
}

describe('replaceManagedBlock', () => {
  it('replaces an existing managed block in place', () => {
    const original = `before\n${START}\nold body\n${END}\nafter`;
    const next = `${START}\nnew body\n${END}`;
    const result = replaceManagedBlock(original, START, END, next);
    expect(result).toContain('new body');
    expect(result).not.toContain('old body');
    expect(result.match(/agentsmesh:test:start/g)).toHaveLength(1);
  });

  it('appends with double newline when content has no managed block', () => {
    const result = replaceManagedBlock('existing text', START, END, BLOCK);
    expect(result).toBe(`existing text\n\n${BLOCK}`);
  });

  it('returns just the block when content is empty', () => {
    expect(replaceManagedBlock('', START, END, BLOCK)).toBe(BLOCK);
  });

  it('returns just the block when content is whitespace-only', () => {
    expect(replaceManagedBlock('   \n\t  ', START, END, BLOCK)).toBe(BLOCK);
  });
});

describe('stripManagedBlock', () => {
  it('removes the managed block and trims', () => {
    const original = `before\n\n${START}\nold\n${END}\n\nafter`;
    const result = stripManagedBlock(original, START, END);
    expect(result).not.toContain(START);
    expect(result).not.toContain(END);
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('returns trimmed content when there is no managed block', () => {
    const result = stripManagedBlock('  hello world  \n', START, END);
    expect(result).toBe('hello world');
  });
});

describe('renderEmbeddedRulesBlock and ruleSource normalization', () => {
  it('returns empty string when given an empty rules array', () => {
    expect(renderEmbeddedRulesBlock([])).toBe('');
  });

  it('produces a full block with start/end markers for non-empty rules', () => {
    const block = renderEmbeddedRulesBlock([makeRule()]);
    expect(block.startsWith(EMBEDDED_RULES_START)).toBe(true);
    expect(block.endsWith(EMBEDDED_RULES_END)).toBe(true);
    expect(block).toContain(EMBEDDED_RULE_END);
  });

  it('slices the path after .agentsmesh/ prefix', () => {
    const rule = makeRule({ source: '/abs/path/.agentsmesh/rules/nested/foo.md' });
    const block = renderEmbeddedRulesBlock([rule]);
    expect(block).toContain('"source":"rules/nested/foo.md"');
  });

  it('normalizes Windows-style separators when slicing .agentsmesh', () => {
    const rule = makeRule({ source: 'C:\\repo\\.agentsmesh\\rules\\win.md' });
    const block = renderEmbeddedRulesBlock([rule]);
    expect(block).toContain('"source":"rules/win.md"');
  });

  it('preserves an already rules/-prefixed source', () => {
    const rule = makeRule({ source: 'rules/already.md' });
    const block = renderEmbeddedRulesBlock([rule]);
    expect(block).toContain('"source":"rules/already.md"');
  });

  it('falls back to join("rules", basename(...)) for unrelated paths', () => {
    const rule = makeRule({ source: '/var/tmp/random/loose.md' });
    const block = renderEmbeddedRulesBlock([rule]);
    expect(block).toContain('"source":"rules/loose.md"');
  });

  it('renders a description heading when rule has description', () => {
    const block = renderEmbeddedRulesBlock([makeRule({ description: 'Header text' })]);
    expect(block).toContain('## Header text');
  });

  it('skips the description heading when description is blank', () => {
    const block = renderEmbeddedRulesBlock([makeRule({ description: '   ' })]);
    expect(block).not.toContain('## ');
  });
});

describe('appendEmbeddedRulesBlock', () => {
  it('returns stripped content when rules are empty and content has the block', () => {
    const existing = `intro\n\n${renderEmbeddedRulesBlock([makeRule()])}\n\noutro`;
    const result = appendEmbeddedRulesBlock(existing, []);
    expect(result).not.toContain(EMBEDDED_RULES_START);
    expect(result).toContain('intro');
    expect(result).toContain('outro');
  });

  it('returns empty string when rules are empty and content has no existing block', () => {
    expect(appendEmbeddedRulesBlock('   ', [])).toBe('');
  });

  it('returns just the block when content is empty and rules are non-empty', () => {
    const result = appendEmbeddedRulesBlock('', [makeRule()]);
    expect(result.startsWith(EMBEDDED_RULES_START)).toBe(true);
    expect(result.endsWith(EMBEDDED_RULES_END)).toBe(true);
  });

  it('appends the block with double newline when content already has text', () => {
    const result = appendEmbeddedRulesBlock('intro', [makeRule()]);
    expect(result.startsWith('intro\n\n')).toBe(true);
    expect(result).toContain(EMBEDDED_RULES_START);
  });
});

describe('extractEmbeddedRules', () => {
  it('returns the trimmed content and empty rules when no managed block exists', () => {
    const result = extractEmbeddedRules('  hello   ');
    expect(result.rootContent).toBe('hello');
    expect(result.rules).toEqual([]);
  });

  it('extracts a valid embedded rule with description heading stripped', () => {
    const rendered = renderEmbeddedRulesBlock([
      makeRule({ description: 'Heading X', body: 'Body content' }),
    ]);
    const wrapped = `intro\n\n${rendered}\n\noutro`;
    const { rootContent, rules } = extractEmbeddedRules(wrapped);
    expect(rootContent).toContain('intro');
    expect(rootContent).toContain('outro');
    expect(rootContent).not.toContain(EMBEDDED_RULES_START);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      source: 'rules/example.md',
      description: 'Heading X',
      globs: [],
      targets: [],
      body: 'Body content',
    });
    expect(rules[0]?.body.startsWith('## ')).toBe(false);
  });

  it('keeps body unchanged when there is no description heading prefix', () => {
    const rule = makeRule({ description: '', body: 'Plain body' });
    const wrapped = renderEmbeddedRulesBlock([rule]);
    const { rules } = extractEmbeddedRules(wrapped);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.body).toBe('Plain body');
  });

  it('skips entries whose marker JSON is invalid', () => {
    const broken = [
      EMBEDDED_RULES_START,
      '<!-- agentsmesh:embedded-rule:start {not-json} -->',
      'body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(broken);
    expect(rules).toEqual([]);
  });

  it('skips entries whose marker source does not start with rules/', () => {
    const marker = JSON.stringify({
      source: 'not-rules/foo.md',
      description: 'd',
      globs: [],
      targets: [],
    });
    const block = [
      EMBEDDED_RULES_START,
      `<!-- agentsmesh:embedded-rule:start ${marker} -->`,
      'body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(block);
    expect(rules).toEqual([]);
  });

  it('skips marker that is a JSON array (not an object)', () => {
    const marker = JSON.stringify(['rules/foo.md']);
    const block = [
      EMBEDDED_RULES_START,
      `<!-- agentsmesh:embedded-rule:start ${marker} -->`,
      'body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(block);
    expect(rules).toEqual([]);
  });

  it('skips marker whose JSON parses to null', () => {
    const block = [
      EMBEDDED_RULES_START,
      '<!-- agentsmesh:embedded-rule:start null -->',
      'body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(block);
    expect(rules).toEqual([]);
  });

  it('uses defaults when description is non-string and globs/targets are non-arrays', () => {
    const marker = JSON.stringify({
      source: 'rules/defaults.md',
      description: 42,
      globs: 'not-an-array',
      targets: { also: 'not-an-array' },
    });
    const block = [
      EMBEDDED_RULES_START,
      `<!-- agentsmesh:embedded-rule:start ${marker} -->`,
      'just body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(block);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      source: 'rules/defaults.md',
      description: '',
      globs: [],
      targets: [],
      body: 'just body',
    });
  });

  it('filters non-string entries inside globs/targets arrays', () => {
    const marker = JSON.stringify({
      source: 'rules/mixed.md',
      description: 'mixed',
      globs: ['**/*.ts', 7, null, 'src/**'],
      targets: ['claude-code', false, 'cursor'],
    });
    const block = [
      EMBEDDED_RULES_START,
      `<!-- agentsmesh:embedded-rule:start ${marker} -->`,
      'body',
      EMBEDDED_RULE_END,
      EMBEDDED_RULES_END,
    ].join('\n');
    const { rules } = extractEmbeddedRules(block);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.globs).toEqual(['**/*.ts', 'src/**']);
    expect(rules[0]?.targets).toEqual(['claude-code', 'cursor']);
  });
});

describe('appendAgentsmeshRootInstructionParagraph branch coverage', () => {
  it('returns the paragraph unchanged when content is empty', () => {
    expect(appendAgentsmeshRootInstructionParagraph('')).toBe(
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  });

  it('returns the paragraph unchanged when content is whitespace-only', () => {
    expect(appendAgentsmeshRootInstructionParagraph('   \n\t')).toBe(
      AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH,
    );
  });
});

describe('stripAgentsmeshRootInstructionParagraph', () => {
  it('removes the managed contract block and surrounding whitespace', () => {
    const content = `Intro\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}\n\nOutro`;
    const result = stripAgentsmeshRootInstructionParagraph(content);
    expect(result).not.toContain(ROOT_CONTRACT_START);
    expect(result).not.toContain(ROOT_CONTRACT_END);
    expect(result).toContain('Intro');
    expect(result).toContain('Outro');
  });

  it('returns empty string when content is only the managed block', () => {
    expect(stripAgentsmeshRootInstructionParagraph(AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH)).toBe('');
  });

  it('removes a legacy paragraph variant appended without managed markers', () => {
    const legacy =
      '## AgentsMesh Generation Contract\n\n' +
      "Create agents, skills, commands, rules, hooks, and MCP in `.agentsmesh`, then run `agentsmesh generate` to sync each tool's native files. Edit `.agentsmesh`, not generated outputs.";
    const content = `Intro\n\n${legacy}`;
    const result = stripAgentsmeshRootInstructionParagraph(content);
    expect(result).toBe('Intro');
  });

  it('returns trimmed content unchanged when no contract paragraph is present', () => {
    expect(stripAgentsmeshRootInstructionParagraph('  hello  ')).toBe('hello');
  });
});
