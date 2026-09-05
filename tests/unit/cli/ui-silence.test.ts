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

// `main()` must be exercised without a real command: routing `matrix` here read
// this repo's own agentsmesh.yaml, resolved its remote `extends`, and cloned a
// private repository — so the test passed only on a machine with credentials
// for it and failed on every CI runner.
vi.mock('../../../src/cli/command-handlers.js', () => ({
  cmdHandlers: {
    probe: async (): Promise<void> => {
      const { ui: liveUi } = await import('../../../src/cli/ui/ui.js');
      liveUi.intro('decorative banner');
      liveUi.spinner().start('working');
      process.stdout.write(JSON.stringify({ success: true, command: 'probe', data: null }));
    },
  },
}));

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
      await main({ command: 'probe', flags: { json: true }, args: [] });
    } finally {
      spy.mockRestore();
      exit.mockRestore();
    }
    expect(clackMock.intro).not.toHaveBeenCalled();
    expect(clackMock.spinner).not.toHaveBeenCalled();
    expect(JSON.parse(writes.join(''))).toMatchObject({ success: true, command: 'probe' });
  });
});
