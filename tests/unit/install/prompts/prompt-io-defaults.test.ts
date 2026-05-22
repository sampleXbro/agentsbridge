/**
 * Branch coverage for prompt-io defaults: lines 25-26 exercise the
 * `options?.input ?? process.stdin` / `options?.output ?? process.stdout`
 * fallbacks. We pre-end an input stream so EOF triggers the no-options path
 * without blocking the test.
 */

import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { readLine } from '../../../../src/install/prompts/prompt-io.js';

describe('prompt-io readLine — default-argument branches', () => {
  it('falls back to process.stdin/stdout when no options are supplied (resolves "" on EOF)', async () => {
    // Save originals so we can restore stdin after the test.
    const originalStdin = process.stdin;
    const fake = new PassThrough();
    fake.end(); // already EOF: triggers the close branch synchronously.
    Object.defineProperty(process, 'stdin', { value: fake, configurable: true });
    try {
      const result = await readLine('prompt> ');
      expect(result).toBe('');
    } finally {
      Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
    }
  });

  it('uses provided input/output streams when supplied', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    process.nextTick(() => input.write('typed answer\n'));
    const result = await readLine('prompt> ', { input, output });
    expect(result).toBe('typed answer');
  });
});
