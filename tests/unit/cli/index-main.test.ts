/**
 * Behavioral coverage for `main()` and `isMainModule()` in src/cli/index.ts:
 * help / version short-circuits, `--help` command help, `--json` logger muting,
 * routing through the command router, and the entry-module detection guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, isMainModule, parseArgs } from '../../../src/cli/index.js';
import { getVersion } from '../../../src/cli/version.js';
import { logger, unmuteLogger } from '../../../src/utils/output/logger.js';

const INDEX_PATH = fileURLToPath(new URL('../../../src/cli/index.ts', import.meta.url));
const VERSION_PATH = fileURLToPath(new URL('../../../src/cli/version.ts', import.meta.url));

let stdout: string[];
let exitSpy: MockInstance<typeof process.exit>;
let argv: string[];
let cwd: string;

beforeEach(() => {
  stdout = [];
  argv = [...process.argv];
  cwd = process.cwd();
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
  process.argv = argv;
  process.chdir(cwd);
  unmuteLogger();
  vi.restoreAllMocks();
});

describe('main', () => {
  it('prints the global help for the help command', async () => {
    await main({ command: 'help', flags: {}, args: [] });
    const out = stdout.join('');
    expect(out).toContain('agentsmesh <command> [flags]');
    expect(out).toContain('Commands:');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints the version for the version command', async () => {
    await main({ command: 'version', flags: {}, args: [] });
    expect(stdout).toEqual([`agentsmesh v${getVersion()}\n`]);
  });

  it('prints command help instead of running the command when --help is set', async () => {
    await main({ command: 'init', flags: { help: true }, args: [] });
    const out = stdout.join('');
    expect(out).toContain('agentsmesh init [flags]');
    expect(out).toContain('Command flags:');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('narrows --help to a lessons subcommand named by the first positional', async () => {
    await main({ command: 'lessons', flags: { help: true }, args: ['add'] });
    expect(stdout.join('')).toContain('agentsmesh lessons add "<rule>" --topic <id>');
  });

  it('rejects an unknown command from the router and leaves the logger audible', async () => {
    await expect(main({ command: 'no-such-command', flags: {}, args: [] })).rejects.toThrow(
      'Unknown command "no-such-command"',
    );
    logger.info('probe');
    expect(stdout.join('')).toContain('probe');
  });

  it('mutes the logger before routing when --json is set', async () => {
    await expect(
      main({ command: 'no-such-command', flags: { json: true }, args: [] }),
    ).rejects.toThrow('Unknown command "no-such-command"');
    logger.info('probe');
    expect(stdout).toEqual([]);
  });

  it('routes a real command and emits its JSON envelope in --json mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'am-'));
    try {
      await mkdir(join(root, '.agentsmesh/rules'), { recursive: true });
      await writeFile(
        join(root, 'agentsmesh.yaml'),
        'version: 1\ntargets: [claude-code]\nfeatures: [rules]\n',
        'utf8',
      );
      await writeFile(join(root, '.agentsmesh/rules/_root.md'), '---\nroot: true\n---\n\nRoot.\n');
      process.chdir(root);
      await main({ command: 'matrix', flags: { json: true }, args: [] });
    } finally {
      process.chdir(cwd);
      await rm(root, { recursive: true, force: true });
    }
    expect(stdout).toHaveLength(1);
    const envelope = JSON.parse(stdout[0]!) as {
      success: boolean;
      command: string;
      data: { targets: string[]; features: Array<{ name: string; support: unknown }> };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('matrix');
    expect(envelope.data.targets).toEqual(['claude-code']);
    const rules = envelope.data.features.find((f) => f.name === 'rules');
    expect(rules?.support).toEqual({ 'claude-code': expect.any(String) });
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

describe('isMainModule', () => {
  it('is false when no script path was given', () => {
    process.argv[1] = '';
    expect(isMainModule()).toBe(false);
  });

  it('is true when the invoked script resolves to src/cli/index.ts', () => {
    process.argv[1] = INDEX_PATH;
    expect(isMainModule()).toBe(true);
  });

  it('is false when the invoked script is a different existing file', () => {
    process.argv[1] = VERSION_PATH;
    expect(isMainModule()).toBe(false);
  });

  it('falls back to the name heuristic when the invoked path does not exist', () => {
    process.argv[1] = '/definitely/missing/cli.js';
    expect(isMainModule()).toBe(true);
    process.argv[1] = '/definitely/missing/other.js';
    expect(isMainModule()).toBe(false);
  });
});

describe('parseArgs — boolean flag later given a value', () => {
  it('replaces an earlier bare flag with the later string value instead of accumulating', () => {
    const result = parseArgs(['cmd', '--x', '--x', 'v']);
    expect(result.command).toBe('cmd');
    expect(result.flags.x).toBe('v');
    expect(result.args).toEqual([]);
  });
});
