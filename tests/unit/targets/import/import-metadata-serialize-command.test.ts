/** Re-import must keep canonical command frontmatter the source format cannot carry. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';
import { serializeImportedCommandWithFallback } from '../../../../src/targets/import/import-metadata-serialize.js';

let root: string;
let dest: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  dest = join(root, '.agentsmesh', 'commands', 'build.md');
  await mkdir(join(root, '.agentsmesh', 'commands'), { recursive: true });
  await writeFile(
    dest,
    '---\ndescription: old\nallowed-tools:\n  - Read\noutputStyle: true\nmodel: opus\n---\nold body\n',
    'utf-8',
  );
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('serializeImportedCommandWithFallback', () => {
  it('keeps existing keys the imported format does not know, and applies the imported ones', async () => {
    const out = await serializeImportedCommandWithFallback(
      dest,
      { hasDescription: true, description: 'new', hasAllowedTools: false },
      'new body',
    );
    expect(parseFrontmatter(out)).toEqual({
      frontmatter: {
        description: 'new',
        'allowed-tools': ['Read'],
        outputStyle: true,
        model: 'opus',
      },
      body: 'new body',
    });
  });

  it('writes only the owned keys into an empty project', async () => {
    const out = await serializeImportedCommandWithFallback(
      join(root, 'missing.md'),
      { hasDescription: true, description: 'd', hasAllowedTools: true, allowedTools: ['Bash'] },
      'b',
    );
    expect(parseFrontmatter(out).frontmatter).toEqual({
      description: 'd',
      'allowed-tools': ['Bash'],
    });
  });
});
