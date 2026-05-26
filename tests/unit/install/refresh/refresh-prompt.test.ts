// tests/unit/install/refresh/refresh-prompt.test.ts
import { describe, expect, it, vi } from 'vitest';
import { promptWithTimeout } from '../../../../src/install/refresh/refresh-prompt.js';

describe('promptWithTimeout', () => {
  it('returns "y" when user answers y', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'y',
    });
    expect(result).toBe('y');
  });

  it('returns "y" for uppercase Y', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'Y',
    });
    expect(result).toBe('y');
  });

  it('returns "n" for n or empty input', async () => {
    expect(await promptWithTimeout('continue?', 1000, { readLine: async () => 'n' })).toBe('n');
    expect(await promptWithTimeout('continue?', 1000, { readLine: async () => '' })).toBe('n');
  });

  it('returns "per-pack" for per-pack', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'per-pack',
    });
    expect(result).toBe('per-pack');
  });

  it('returns "timeout" when no answer arrives within timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const never: Promise<string> = new Promise(() => {
        // never resolves
      });
      const promise = promptWithTimeout('continue?', 50, {
        readLine: () => never,
      });
      await vi.advanceTimersByTimeAsync(60);
      expect(await promise).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns "n" for any other unrecognized input', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'wat',
    });
    expect(result).toBe('n');
  });
});
