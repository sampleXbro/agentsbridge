/**
 * E2E helper: run agentsmesh CLI in a given directory.
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const TIMEOUT_MS = 60_000;

export interface RunCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute agentsmesh CLI with given args in given cwd.
 * @param args - CLI arguments (e.g. "--version", "init", "generate --dry-run")
 * @param cwd - Working directory
 * @returns stdout, stderr, and exit code
 */
export async function runCli(
  args: string,
  cwd: string,
  extraEnv: Record<string, string | undefined> = {},
): Promise<RunCliResult> {
  return runCliArgs(args.trim().split(/\s+/).filter(Boolean), cwd, extraEnv);
}

/**
 * Like {@link runCli} but takes an explicit argv array, so values containing
 * spaces (a lesson rule, a topic summary) survive intact instead of being
 * whitespace-split. Use this for `lessons add "<rule>"` and similar.
 * @param argList - exact argv passed to `dist/cli.js`
 * @param cwd - Working directory
 */
export async function runCliArgs(
  argList: string[],
  cwd: string,
  extraEnv: Record<string, string | undefined> = {},
): Promise<RunCliResult> {
  // On Windows, `os.homedir()` reads USERPROFILE, not HOME — so tests that
  // redirect the CLI to a fake home via `HOME` must also override USERPROFILE
  // (and HOMEDRIVE/HOMEPATH, which Node consults as a secondary fallback).
  // Without this, `--global` writes land in the real `C:\Users\<user>\.agentsmesh`
  // on CI and tests fail intermittently or pollute the runner home.
  const homeOverride = extraEnv.HOME;
  const platformHomeEnv: Record<string, string | undefined> =
    process.platform === 'win32' && typeof homeOverride === 'string'
      ? {
          USERPROFILE: homeOverride,
          HOMEDRIVE: homeOverride.slice(0, 2),
          HOMEPATH: homeOverride.slice(2),
        }
      : {};
  const env = { ...process.env, ...platformHomeEnv, ...extraEnv, NO_COLOR: '1' };

  return new Promise<RunCliResult>((resolve, _reject) => {
    let proc: ChildProcess | null = null;
    const timer = setTimeout(() => {
      proc?.kill('SIGTERM');
      resolve({
        stdout: '',
        stderr: 'Command timed out',
        exitCode: 1,
      });
    }, TIMEOUT_MS);

    proc = spawn('node', [CLI_PATH, ...argList], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => (stdout += String(chunk)));
    proc.stderr?.on('data', (chunk) => (stderr += String(chunk)));

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      const exitCode =
        code !== null ? code : signal === 'SIGTERM' ? 143 : signal === 'SIGKILL' ? 137 : 1;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      const status =
        err && typeof err === 'object' && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim() || err.message,
        exitCode: typeof status === 'number' ? status : 1,
      });
    });
  });
}
