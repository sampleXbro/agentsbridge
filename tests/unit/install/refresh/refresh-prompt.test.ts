// tests/unit/install/refresh/refresh-prompt.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  promptWithTimeout,
  runConsentPrompt,
} from '../../../../src/install/refresh/refresh-prompt.js';

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

describe('runConsentPrompt', () => {
  it('returns decisions: { proceed: true, perPack: false } when user answers y', async () => {
    const result = await runConsentPrompt(
      [
        { name: 'a', modifiedCount: 3 },
        { name: 'b', modifiedCount: 1 },
      ],
      { timeoutMs: 1000, readLine: async () => 'y' },
    );
    expect(result).toEqual({ proceed: true, perPack: false, declined: [] });
  });

  it('returns decisions: { proceed: false, declined: all } when user answers n', async () => {
    const result = await runConsentPrompt(
      [
        { name: 'a', modifiedCount: 3 },
        { name: 'b', modifiedCount: 1 },
      ],
      { timeoutMs: 1000, readLine: async () => 'n' },
    );
    expect(result).toEqual({ proceed: false, perPack: false, declined: ['a', 'b'] });
  });

  it('returns decisions: { proceed: false, declined: all } on timeout', async () => {
    vi.useFakeTimers();
    try {
      const never: Promise<string> = new Promise(() => {});
      const promise = runConsentPrompt([{ name: 'a', modifiedCount: 1 }], {
        timeoutMs: 50,
        readLine: () => never,
      });
      await vi.advanceTimersByTimeAsync(60);
      expect(await promise).toEqual({ proceed: false, perPack: false, declined: ['a'] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns { proceed: true, perPack: true } for per-pack', async () => {
    const result = await runConsentPrompt([{ name: 'a', modifiedCount: 1 }], {
      timeoutMs: 1000,
      readLine: async () => 'per-pack',
    });
    expect(result).toEqual({ proceed: true, perPack: true, declined: [] });
  });
});
