import { afterEach, beforeEach, vi } from 'vitest';

interface CapturedOutput {
  stdout: () => string;
  stderr: () => string;
}

export function useCapturedOutput(): CapturedOutput {
  let stdout: string[] = [];
  let stderr: string[] = [];
  let previousNoColor: string | undefined;

  beforeEach(() => {
    stdout = [];
    stderr = [];
    previousNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    if (previousNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previousNoColor;
    vi.restoreAllMocks();
  });

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}
