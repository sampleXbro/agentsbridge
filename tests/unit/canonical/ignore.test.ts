import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseIgnore } from '../../../src/canonical/features/ignore.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-ignore-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('parseIgnore', () => {
  it('parses gitignore-style patterns', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(
      path,
      `
node_modules
dist
*.log
build/
`,
    );
    const result = await parseIgnore(path);
    expect(result).toEqual(['node_modules', 'dist', '*.log', 'build/']);
  });

  it('skips empty lines', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(
      path,
      `

foo


bar
`,
    );
    const result = await parseIgnore(path);
    expect(result).toEqual(['foo', 'bar']);
  });

  it('skips comment lines', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(
      path,
      `
# ignore dependencies
node_modules
# and build output
dist
`,
    );
    const result = await parseIgnore(path);
    expect(result).toEqual(['node_modules', 'dist']);
  });

  it('trims leading and trailing whitespace from patterns', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(path, '  foo  \n  bar  ');
    const result = await parseIgnore(path);
    expect(result).toEqual(['foo', 'bar']);
  });

  it('returns empty array for non-existent file', async () => {
    const result = await parseIgnore(join(TEST_DIR, 'nope'));
    expect(result).toEqual([]);
  });

  it('returns empty array for empty file', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(path, '');
    const result = await parseIgnore(path);
    expect(result).toEqual([]);
  });

  it('returns empty array when file has only comments and empty lines', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(
      path,
      `
# comment 1

# comment 2
`,
    );
    const result = await parseIgnore(path);
    expect(result).toEqual([]);
  });

  it('preserves pattern with # in the middle (not treated as comment)', async () => {
    const path = join(TEST_DIR, 'ignore');
    writeFileSync(path, 'path/with#hash');
    const result = await parseIgnore(path);
    expect(result).toEqual(['path/with#hash']);
  });
});
