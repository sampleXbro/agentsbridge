/**
 * The `if (isMainModule())` entry block in src/cli/index.ts only runs when the
 * module is the process entry point. Re-import the module with `process.argv[1]`
 * pointed at it to prove the block parses argv, runs `main`, and routes a
 * rejected run through `handleError` with the parsed json/command options.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { getVersion } from '../../../src/cli/version.js';

const INDEX_PATH = fileURLToPath(new URL('../../../src/cli/index.ts', import.meta.url));

let stdout: string[];
let argv: string[];

beforeEach(() => {
  stdout = [];
  argv = [...process.argv];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.resetModules();
});

afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
});

describe('cli entry block', () => {
  it('parses argv and runs main when imported as the entry module', async () => {
    process.argv = ['node', INDEX_PATH, '--version'];
    await import('../../../src/cli/index.js');
    expect(stdout).toEqual([`agentsmesh v${getVersion()}\n`]);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('routes a rejected main through handleError with json + command from argv', async () => {
    process.argv = ['node', INDEX_PATH, 'no-such-command', '--json'];
    await import('../../../src/cli/index.js');
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0]!)).toEqual({
      success: false,
      command: 'no-such-command',
      error: expect.stringContaining('Unknown command "no-such-command"'),
    });
  });
});
