/**
 * A file sitting inside a managed directory that agentsmesh never generated is
 * NOT drift — Kiro's Agent Hooks UI writes `.kiro/hooks/*.kiro.hook`, Cursor
 * writes `.cursor/rules/*.mdc`, users hand-author skills. `check` used to report
 * those as "generated output ... is stale" and exit 1, and neither remedy it
 * printed could clear it, because `generate` no longer deletes them.
 *
 * They are still worth surfacing: a rule hand-added straight into `.claude/rules`
 * instead of canonical is something the user wants to know about. So they are
 * reported as a NOTICE that does not affect `inSync` or the exit code.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLockSync } from '../../../../src/core/check/lock-sync.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const CONFIG = {
  version: 1,
  targets: ['kiro'],
  features: ['rules'],
  extends: [],
} as unknown as ValidatedConfig;

function project(outputs: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'am-untracked-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  writeFileSync(
    join(dir, '.agentsmesh', '.lock'),
    [
      'generated_at: 2026-01-01T00:00:00.000Z',
      'checksums: {}',
      Object.keys(outputs).length === 0
        ? 'outputs: {}'
        : ['outputs:', ...Object.entries(outputs).map(([k, v]) => `  ${k}: ${v}`)].join('\n'),
    ].join('\n') + '\n',
  );
  return dir;
}

describe('untracked files inside managed directories', () => {
  it('reports a tool-written file as a notice, not as drift', async () => {
    const root = project({});
    mkdirSync(join(root, '.kiro', 'hooks'), { recursive: true });
    writeFileSync(join(root, '.kiro', 'hooks', 'my-hook.kiro.hook'), '{"name":"mine"}\n');

    const report = await checkLockSync({
      config: CONFIG,
      configDir: root,
      canonicalDir: join(root, '.agentsmesh'),
      rootBase: root,
    });

    expect(report.outputsUntracked).toEqual(['.kiro/hooks/my-hook.kiro.hook']);
    expect(report.outputsStale).toEqual([]);
    expect(report.outputDrift).toBe(false);
    expect(report.inSync).toBe(true);
  });

  it('does not report a file the lock says agentsmesh generated', async () => {
    const root = project({ '.kiro/hooks/generated.kiro.hook': 'sha256:abc' });
    mkdirSync(join(root, '.kiro', 'hooks'), { recursive: true });
    writeFileSync(join(root, '.kiro', 'hooks', 'generated.kiro.hook'), '{}\n');

    const report = await checkLockSync({
      config: CONFIG,
      configDir: root,
      canonicalDir: join(root, '.agentsmesh'),
      rootBase: root,
    });
    expect(report.outputsUntracked).toEqual([]);
  });
});
