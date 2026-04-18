import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('generate path rebasing source of truth', () => {
  it('does not keep a standalone global path rebaser alongside target layouts', () => {
    expect(existsSync(join(process.cwd(), 'src/core/generate/global-path-rebaser.ts'))).toBe(false);
  });
});
