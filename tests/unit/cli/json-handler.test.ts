import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleResult } from '../../../src/cli/json-handler.js';

describe('handleResult', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('calls render and does not emit JSON when json flag is false', () => {
    const render = vi.fn();
    const flags = { json: false };
    handleResult('lint', { exitCode: 0, data: { diagnostics: [] } }, flags, render);
    expect(render).toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('emits JSON and exits 0 on success in json mode', () => {
    const render = vi.fn();
    const flags = { json: true };
    handleResult('generate', { exitCode: 0, data: { files: [] } }, flags, render);
    expect(render).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      success: true,
      command: 'generate',
      data: { files: [] },
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('emits JSON and exits non-zero on failure in json mode', () => {
    const render = vi.fn();
    const flags = { json: true };
    handleResult('lint', { exitCode: 1, data: { diagnostics: ['err'] } }, flags, render);
    expect(render).not.toHaveBeenCalled();
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      success: false,
      command: 'lint',
      error: "Command 'lint' failed",
      data: { diagnostics: ['err'] },
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits non-zero in non-json mode when exitCode is non-zero', () => {
    const render = vi.fn();
    const flags = {};
    handleResult('check', { exitCode: 1, data: {} }, flags, render);
    expect(render).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit in non-json mode when exitCode is 0', () => {
    const render = vi.fn();
    const flags = {};
    handleResult('generate', { exitCode: 0, data: {} }, flags, render);
    expect(render).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
