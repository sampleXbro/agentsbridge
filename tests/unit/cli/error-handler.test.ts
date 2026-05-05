import { afterEach, describe, it, expect, vi } from 'vitest';
import { handleError } from '../../../src/cli/error-handler.js';

describe('handleError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints user-friendly message for known errors', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleError(new Error('Config file not found'));
    expect(spy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints stack trace in verbose mode', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleError(new Error('test'), { verbose: true });
    const output = spy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Error: test');
  });

  it('emits JSON envelope to stdout when json option is true', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError(new Error('something broke'), { json: true, command: 'generate' });

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const parsed = JSON.parse(output.trim()) as {
      success: boolean;
      command: string;
      error: string;
    };
    expect(parsed).toEqual({ success: false, command: 'generate', error: 'something broke' });
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('uses "unknown" as command when json is true but command is not provided', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError(new Error('oops'), { json: true });

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const parsed = JSON.parse(output.trim()) as {
      success: boolean;
      command: string;
      error: string;
    };
    expect(parsed.command).toBe('unknown');
  });
});
