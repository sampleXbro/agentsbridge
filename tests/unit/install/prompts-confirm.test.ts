/**
 * confirm() must delegate to the shared readLine primitive so it inherits the
 * safe EOF/error handling (EOF → decline, no hang, no crash). It declines
 * immediately on a non-TTY without touching stdin.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const mockReadLine = vi.hoisted(() => vi.fn());
vi.mock('../../../src/install/prompts/prompt-io.js', () => ({ readLine: mockReadLine }));

import { confirm } from '../../../src/install/core/prompts.js';

const origIsTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

function setTty(value: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true });
}

describe('confirm', () => {
  afterEach(() => {
    vi.clearAllMocks();
    if (origIsTty) Object.defineProperty(process.stdin, 'isTTY', origIsTty);
  });

  it('declines without prompting on a non-TTY stdin', async () => {
    setTty(false);
    expect(await confirm('overwrite?')).toBe(false);
    expect(mockReadLine).not.toHaveBeenCalled();
  });

  it('returns true for y / yes (case-insensitive)', async () => {
    setTty(true);
    mockReadLine.mockResolvedValueOnce('y');
    expect(await confirm('overwrite?')).toBe(true);
    mockReadLine.mockResolvedValueOnce('  YES ');
    expect(await confirm('overwrite?')).toBe(true);
  });

  it("declines for anything else, including EOF ('') — never hangs", async () => {
    setTty(true);
    mockReadLine.mockResolvedValueOnce('n');
    expect(await confirm('overwrite?')).toBe(false);
    mockReadLine.mockResolvedValueOnce('');
    expect(await confirm('overwrite?')).toBe(false);
  });
});
