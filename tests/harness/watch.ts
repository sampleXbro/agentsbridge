/**
 * Watch-test harness (Testing Strategy §8): fresh temp roots, coverage-aware timeouts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { runWatch } from '../../src/cli/commands/watch.js';
import type { RunWatchOptions } from '../../src/cli/commands/watch.js';
export { runWatch };
export type { RunWatchOptions, WatchCycleInfo } from '../../src/cli/commands/watch.js';

/**
 * Polling options every watch test should pass to `runWatch`. macOS FSEvents
 * (and Linux inotify under load) drops events for files created in
 * subdirectories that were freshly added to the watch tree — exactly what
 * every watch test does. Forcing chokidar's polling backend at a tight 50ms
 * interval removes the kernel race entirely (lessons.md L240, L242).
 *
 * `runWatch` is exported directly from the production module (not wrapped) so
 * that consumer tests like `command-handlers-watch-install.test.ts` can
 * `vi.mock('../../src/cli/commands/watch.js')` and have the mock reach the
 * harness import via ESM live bindings.
 */
export const WATCH_TEST_OPTS = Object.freeze({
  usePolling: true,
  pollIntervalMs: 50,
}) satisfies RunWatchOptions;

export function coverageScale(): number {
  return process.env['COVERAGE'] === '1' ? 1.5 : 1;
}

/**
 * Default `vi.waitFor` timeout for watch assertions (15s, ×1.5 under coverage = ~22s).
 *
 * Tests force chokidar polling at 50ms (see `WATCH_TEST_OPTS` above), so cycle
 * latency under load is bounded by `poll(50ms) + debounce(300ms) + generate work
 * (~1–3s)` rather than the kernel FSEvents queue depth. The previous 120s budget
 * existed to absorb FSEvents starvation under parallel test load — once we left
 * that path the budget can shrink by an order of magnitude. A tight gate fails
 * fast on real regressions instead of hanging the pre-commit hook for minutes
 * (lessons.md L60, L153, L240).
 */
export function watchWaitTimeoutMs(): number {
  return Math.round(15_000 * coverageScale());
}

/** Idle stability window after watcher events (1.5s, ×1.5 under coverage). */
export function watchStabilityDelayMs(): number {
  return Math.round(1_500 * coverageScale());
}

export function createWatchTestDir(): string {
  return join(tmpdir(), `am-watch-${randomBytes(8).toString('hex')}`);
}

export function writeMinimalWatchProject(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
}
