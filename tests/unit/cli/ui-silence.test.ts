/** `--json` must silence the decorative UI even on a TTY, so stdout stays one JSON envelope. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clackMock = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
  log: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), step: vi.fn() },
}));
vi.mock('@clack/prompts', () => clackMock);

import { configureUi, silenceUi, ui } from '../../../src/cli/ui/ui.js';
import { main } from '../../../src/cli/index.js';

beforeEach(() => {
  vi.clearAllMocks();
  configureUi({ isTTY: true });
});

describe('ui silencing', () => {
  it('uses clack on a TTY', () => {
    ui.intro('title');
    expect(clackMock.intro).toHaveBeenCalledWith('title');
  });

  it('silenceUi() stops every decorative call from reaching the terminal', () => {
    silenceUi();
    ui.intro('title');
    ui.spinner().start('x');
    ui.outro('done');
    expect(clackMock.intro).not.toHaveBeenCalled();
    expect(clackMock.spinner).not.toHaveBeenCalled();
    expect(clackMock.outro).not.toHaveBeenCalled();
  });

  it('main() with --json silences the UI before routing', async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    try {
      await main({ command: 'matrix', flags: { json: true }, args: [] });
    } finally {
      spy.mockRestore();
      exit.mockRestore();
    }
    expect(clackMock.intro).not.toHaveBeenCalled();
    expect(() => JSON.parse(writes.join(''))).not.toThrow();
  });
});
