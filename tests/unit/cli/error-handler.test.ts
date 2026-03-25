import { describe, it, expect, vi } from 'vitest';
import { handleError } from '../../../src/cli/error-handler.js';

describe('handleError', () => {
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
});
