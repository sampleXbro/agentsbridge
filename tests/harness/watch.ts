/**
 * Watch-test harness (Testing Strategy §8): fresh temp roots, coverage-aware timeouts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { runWatch } from '../../src/cli/commands/watch.js';

export function coverageScale(): number {
  return process.env['COVERAGE'] === '1' ? 1.5 : 1;
}

/** Default `vi.waitFor` timeout for watch assertions (12s, ×1.5 under coverage). */
export function watchWaitTimeoutMs(): number {
  return Math.round(12_000 * coverageScale());
}

/** Idle stability window after watcher events (3s, ×1.5 under coverage). */
export function watchStabilityDelayMs(): number {
  return Math.round(3_000 * coverageScale());
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

export { runWatch };
