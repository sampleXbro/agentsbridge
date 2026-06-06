import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cmdHandlers } from '../../../src/cli/command-handlers.js';

let cwd: string;
let tmp: string;

beforeEach(() => {
  cwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), 'amesh-cmd-lessons-'));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(tmp, { recursive: true, force: true });
});

describe('cmdHandlers.lessons (dispatch)', () => {
  it('narrows array-valued flags and exits with the command code on failure', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    try {
      // `show` with no topic arg fails (exit 2); the array flag drives narrowFlags' array branch.
      await cmdHandlers.lessons!({ json: true, repeated: ['a', 'b'] }, ['show']);
      expect(exit).toHaveBeenCalledWith(2);
    } finally {
      exit.mockRestore();
    }
  });
});
