import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { splitEmbeddedRulesToCanonical } from '../../../../src/targets/import/embedded-rules.js';
import {
  EMBEDDED_RULES_START,
  EMBEDDED_RULES_END,
} from '../../../../src/targets/projection/managed-blocks.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-emb-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function inlineRule(args: {
  source: string;
  description?: string;
  globs?: string[];
  targets?: string[];
  body: string;
}): string {
  const meta = JSON.stringify({
    source: args.source,
    description: args.description ?? '',
    globs: args.globs ?? [],
    targets: args.targets ?? [],
  });
  return [
    `<!-- agentsmesh:embedded-rule:start ${meta} -->`,
    args.body,
    '<!-- agentsmesh:embedded-rule:end -->',
  ].join('\n');
}

function block(rules: string[]): string {
  return [EMBEDDED_RULES_START, ...rules, EMBEDDED_RULES_END].join('\n');
}

describe('splitEmbeddedRulesToCanonical — branches', () => {
  it('returns rootContent unchanged with no rules when content has no embedded block', async () => {
    const result = await splitEmbeddedRulesToCanonical({
      content: '# just root content',
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toEqual([]);
    expect(result.rootContent).toBe('# just root content');
  });

  it('skips embedded rules whose source is not under rules/', async () => {
    // managed-blocks parser actually only accepts source under rules/, so embedded entries
    // with foreign sources are ignored (parseMarker returns null).
    const content = block([inlineRule({ source: 'commands/foo.md', body: 'should be ignored' })]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toEqual([]);
  });

  it('skips _root.md embedded rule (already represented by host file)', async () => {
    const content = block([
      inlineRule({ source: 'rules/_root.md', body: 'root body' }),
      inlineRule({ source: 'rules/normal.md', body: 'normal body' }),
    ]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/normal.md']);
    expect(existsSync(join(projectRoot, '.agentsmesh/rules/normal.md'))).toBe(true);
  });

  it('skips embedded rules whose source ends in / (directory-like)', async () => {
    const content = block([inlineRule({ source: 'rules/sub/', body: 'invalid' })]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toEqual([]);
  });

  it('skips embedded rules whose source does not end with .md', async () => {
    const content = block([inlineRule({ source: 'rules/x.txt', body: 'wrong ext' })]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toEqual([]);
  });

  it('writes embedded rule with description, globs and targets', async () => {
    const content = block([
      inlineRule({
        source: 'rules/typescript.md',
        description: 'TS rules',
        globs: ['src/**/*.ts'],
        targets: ['claude-code'],
        body: '## TS rules\n\nUse strict mode.',
      }),
    ]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.toPath).toBe('.agentsmesh/rules/typescript.md');
  });

  it('handles backslash-normalized rule source paths', async () => {
    const content = block([inlineRule({ source: 'rules\\nested\\file.md', body: 'win' })]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    // managed-blocks parseMarker requires source to start with rules/, so backslash form fails parsing.
    expect(result.results).toEqual([]);
  });
});
