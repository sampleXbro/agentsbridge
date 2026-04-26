import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('generation architecture boundaries', () => {
  it('keeps optional feature emission target-agnostic', () => {
    const source = readFileSync(join(ROOT, 'src/core/generate/optional-features.ts'), 'utf8');

    expect(source).not.toContain('../../targets/gemini-cli/');
  });
});
