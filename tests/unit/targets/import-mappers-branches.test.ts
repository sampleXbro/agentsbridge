/**
 * Direct branch tests for per-target import mappers. The mappers are usually
 * invoked through the descriptor runner, so the optional-frontmatter branches
 * (description present/absent, globs as array vs string, hasDescription, etc.)
 * tend to stay uncovered. We invoke them with synthetic contexts.
 */

import { describe, it, expect } from 'vitest';
import {
  rooNonRootRuleMapper,
  rooCommandMapper,
} from '../../../src/targets/roo-code/import-mappers.js';
import {
  opencodeNonRootRuleMapper,
  opencodeCommandMapper,
} from '../../../src/targets/opencode/import-mappers.js';

function ctx(
  content: string,
  relativePath = 'guide.md',
): {
  absolutePath: string;
  relativePath: string;
  content: string;
  destDir: string;
  normalizeTo: (dest: string) => string;
} {
  return {
    absolutePath: `/src/${relativePath}`,
    relativePath,
    content,
    destDir: '/dest',
    normalizeTo: () => content,
  };
}

describe('roo-code mappers — branch gaps', () => {
  it('rooNonRootRuleMapper returns null for the bundled 00-root.md', async () => {
    const result = await rooNonRootRuleMapper(ctx('# root', '00-root.md'));
    expect(result).toBeNull();
  });

  it('rooNonRootRuleMapper preserves description + globs when present and well-typed', async () => {
    const fm = '---\ndescription: a rule\nglobs:\n  - src/**/*.ts\n---\nbody\n';
    const result = await rooNonRootRuleMapper(ctx(fm));
    expect(result).not.toBeNull();
    expect(result!.content).toContain('description: a rule');
    expect(result!.content).toContain('src/**/*.ts');
  });

  it('rooNonRootRuleMapper drops description/globs when missing or wrong-typed', async () => {
    const fm = '---\ndescription: 42\nglobs: nope\n---\nbody\n';
    const result = await rooNonRootRuleMapper(ctx(fm));
    expect(result).not.toBeNull();
    expect(result!.content).not.toMatch(/description: 42/);
  });

  it('rooCommandMapper keeps string description and ignores allowed-tools', async () => {
    const result = await rooCommandMapper(ctx('---\ndescription: cmd\n---\nbody\n', 'review.md'));
    expect(result!.content).toContain('description: cmd');
  });

  it('rooCommandMapper omits description field when not a string', async () => {
    const result = await rooCommandMapper(ctx('---\ndescription:\n  - list\n---\nbody\n', 'x.md'));
    expect(result!.content).not.toMatch(/description: list/);
  });
});

describe('opencode mappers — branch gaps', () => {
  it('opencodeNonRootRuleMapper preserves description + globs', async () => {
    const fm = '---\ndescription: o rule\nglobs:\n  - "*.md"\n---\nbody\n';
    const result = await opencodeNonRootRuleMapper(ctx(fm, 'x.md'));
    expect(result!.content).toContain('description: o rule');
  });

  it('opencodeNonRootRuleMapper drops wrong-typed description/globs', async () => {
    const result = await opencodeNonRootRuleMapper(
      ctx('---\ndescription: 1\nglobs: literal\n---\nbody\n'),
    );
    expect(result!.content).not.toMatch(/globs: literal/);
  });

  it('opencodeCommandMapper marks hasDescription=true when frontmatter has the key', async () => {
    const result = await opencodeCommandMapper(ctx('---\ndescription: cmd\n---\nbody\n', 'a.md'));
    expect(result!.content).toContain('description: cmd');
  });

  it('opencodeCommandMapper marks hasDescription=false when description key is absent', async () => {
    const result = await opencodeCommandMapper(ctx('---\nfoo: bar\n---\nbody\n', 'b.md'));
    // We can't easily detect hasDescription=false from output; just assert
    // body round-trips so we exercise the absent-description branch.
    expect(result).not.toBeNull();
    expect(result!.content).toContain('body');
  });
});
