/**
 * `stopWatchChild` bounds watch-spec teardown.
 *
 * The previous inline shutdown — `child.kill('SIGINT'); await new Promise((r) =>
 * child.on('exit', r))` — hangs forever when the child already exited before the
 * listener was attached (the 'exit' event has been emitted and will not repeat), and
 * hangs until the suite timeout when the child ignores SIGINT. Both turn a slow run
 * into a hard failure with a useless timeout message instead of the real assertion.
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { stopWatchChild } from '../../harness/watch.js';

/** Spawn a node child that stays alive until killed. */
function spawnIdleChild(ignoreSigint: boolean): ChildProcess {
  const script = ignoreSigint
    ? "process.on('SIGINT', () => {}); setInterval(() => {}, 1000);"
    : 'setInterval(() => {}, 1000);';
  return spawn(process.execPath, ['-e', script], { stdio: 'ignore' });
}

describe('stopWatchChild', () => {
  it('resolves after a child exits on SIGINT', async () => {
    const child = spawnIdleChild(false);
    await stopWatchChild(child);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });

  it('resolves immediately when the child already exited', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    await new Promise((resolve) => child.once('exit', resolve));
    // The 'exit' event has already fired; a fresh listener would never see it.
    await expect(stopWatchChild(child)).resolves.toBeUndefined();
  });

  it('escalates to SIGKILL when the child ignores SIGINT', async () => {
    const child = spawnIdleChild(true);
    const start = Date.now();
    await stopWatchChild(child, 300);
    expect(Date.now() - start).toBeLessThan(5_000);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });
});
