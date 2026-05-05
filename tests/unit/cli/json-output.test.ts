import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emitJson } from '../../../src/cli/json-output.js';
import type { CommandResult } from '../../../src/cli/command-result.js';

describe('emitJson', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('emits success envelope with data', () => {
    const result: CommandResult = { success: true, data: { files: ['a.md'] } };
    emitJson('generate', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      success: true,
      command: 'generate',
      data: { files: ['a.md'] },
    });
  });

  it('emits failure envelope with error', () => {
    const result: CommandResult = { success: false, error: 'Config not found' };
    emitJson('init', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      success: false,
      command: 'init',
      error: 'Config not found',
    });
  });

  it('outputs exactly one line ending with newline', () => {
    const result: CommandResult = { success: true, data: null };
    emitJson('check', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    expect(output.endsWith('\n')).toBe(true);
    expect(output.split('\n').length).toBe(2); // content + empty after trailing newline
  });

  it('does not include data field on failure without data', () => {
    const result: CommandResult = { success: false, error: 'Something broke' };
    emitJson('generate', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).not.toHaveProperty('data');
  });

  it('does not include error field on success', () => {
    const result: CommandResult = { success: true, data: { count: 3 } };
    emitJson('lint', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).not.toHaveProperty('error');
  });

  it('includes optional data on failure when provided', () => {
    const result: CommandResult = {
      success: false,
      error: '2 lint errors',
      data: { diagnostics: [{ level: 'error', message: 'bad' }] },
    };
    emitJson('lint', result);
    const output = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      success: false,
      command: 'lint',
      error: '2 lint errors',
      data: { diagnostics: [{ level: 'error', message: 'bad' }] },
    });
  });
});
