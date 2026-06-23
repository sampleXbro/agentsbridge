import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as clack from '@clack/prompts';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(), outro: vi.fn(), note: vi.fn(),
  log: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), step: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
}));

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock('../../../../src/utils/output/logger.js', () => ({ logger: loggerMock }));

import { createUi } from '../../../../src/cli/ui/ui.js';

describe('ui facade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('off-TTY: status methods delegate to logger; decorations are no-ops', () => {
    const ui = createUi({ isTTY: false });
    ui.success('done'); ui.error('boom'); ui.warn('careful'); ui.info('fyi'); ui.step('s');
    ui.intro('x'); ui.outro('y'); ui.note('body', 'title');
    const sp = ui.spinner(); sp.start('working'); sp.stop('finished'); sp.message('m');
    expect(loggerMock.success).toHaveBeenCalledWith('done');
    expect(loggerMock.error).toHaveBeenCalledWith('boom');
    expect(loggerMock.warn).toHaveBeenCalledWith('careful');
    expect(loggerMock.info).toHaveBeenCalledWith('fyi');
    expect(clack.intro).not.toHaveBeenCalled();
    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.spinner).not.toHaveBeenCalled();
  });

  it('on-TTY: status + decorations route to clack; logger untouched', () => {
    const ui = createUi({ isTTY: true });
    ui.success('done'); ui.error('boom'); ui.intro('x'); ui.outro('y'); ui.note('body', 'title');
    const sp = ui.spinner(); sp.start('working'); sp.stop('finished');
    expect(clack.log.success).toHaveBeenCalledWith('done');
    expect(clack.log.error).toHaveBeenCalledWith('boom');
    expect(clack.intro).toHaveBeenCalledWith('x');
    expect(clack.outro).toHaveBeenCalledWith('y');
    expect(clack.note).toHaveBeenCalledWith('body', 'title');
    expect(clack.spinner).toHaveBeenCalledTimes(1);
    expect(loggerMock.success).not.toHaveBeenCalled();
  });
});
