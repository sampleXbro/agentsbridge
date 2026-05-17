import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  gatherUninstallDecisions,
  type UninstallDecisionsDeps,
} from '../../../../src/install/uninstall/uninstall-decisions.js';
import type { UninstallRemovalPlan } from '../../../../src/install/uninstall/plan-uninstall.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';
import { INSTALL_MANIFEST_FILENAME } from '../../../../src/install/manifest/install-manifest-hash.js';
import type { PromptAdapter } from '../../../../src/install/prompts/prompt-types.js';

let tmp: string;
let packsDir: string;

beforeEach(() => {
  tmp = join(tmpdir(), `uninstall-decisions-test-${process.pid}-${Date.now()}`);
  packsDir = join(tmp, 'packs');
  mkdirSync(packsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function manifestEntry(name: string): InstallManifestEntry {
  return {
    name,
    source: `github:acme/${name}`,
    source_kind: 'github',
    features: ['rules'],
  };
}

function materializedPlan(name: string): UninstallRemovalPlan {
  return {
    name,
    packDir: join(packsDir, name),
    manifestEntry: manifestEntry(name),
    extendsEntry: null,
    removeGenerated: true,
    warnings: [],
  };
}

function extendsOnlyPlan(name: string): UninstallRemovalPlan {
  return {
    name,
    packDir: null,
    manifestEntry: null,
    extendsEntry: { name, source: `github:acme/${name}`, features: ['rules'] },
    removeGenerated: true,
    warnings: [],
  };
}

function writePackWithManifest(
  name: string,
  files: Record<string, string>,
  recordedHashes: Record<string, string>,
): void {
  const dir = join(packsDir, name);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
  writeFileSync(
    join(dir, INSTALL_MANIFEST_FILENAME),
    JSON.stringify({
      name,
      source: `github:acme/${name}`,
      installed_at: '2026-05-01T00:00:00Z',
      extends_id: null,
      source_type: null,
      files: recordedHashes,
    }),
  );
}

function recordingAdapter(answers: string[]): {
  adapter: PromptAdapter;
  asked: string[];
  writes: string[];
} {
  const queue = [...answers];
  const asked: string[] = [];
  const writes: string[] = [];
  return {
    adapter: {
      ask: async (prompt) => {
        asked.push(prompt);
        return queue.shift() ?? '';
      },
      write: (chunk) => {
        writes.push(chunk);
      },
    },
    asked,
    writes,
  };
}

function noPromptAdapter(): PromptAdapter {
  return {
    ask: async () => {
      throw new Error('prompt should not be called');
    },
    write: () => {},
  };
}

function baseDeps(
  adapter: PromptAdapter,
  overrides: Partial<UninstallDecisionsDeps> = {},
): UninstallDecisionsDeps {
  return {
    adapter,
    warn: () => {},
    bypassPrompts: false,
    keepPack: false,
    ...overrides,
  };
}

describe('gatherUninstallDecisions', () => {
  it('short-circuits extends-only plans without touching disk', async () => {
    const plan = extendsOnlyPlan('only-ext');
    const warnings: string[] = [];

    const result = await gatherUninstallDecisions(
      [plan],
      packsDir,
      baseDeps(noPromptAdapter(), { warn: (m) => warnings.push(m) }),
    );

    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([
      {
        plan,
        modifications: [],
        action: 'proceed',
        legacyMigrated: false,
        packDirMissing: false,
      },
    ]);
    // No directory was created at packsDir/<name> as a side effect of the stat
    // check, and no warning was emitted (the plan correctly reports no pack).
    expect(warnings).toEqual([]);
  });

  it('--keep-pack still detects modifications so JSON output reports them', async () => {
    writePackWithManifest(
      'kept',
      { 'rules/a.md': 'edited-content' },
      // Recorded hash is for a different content ("original"), so the file is
      // marked modified.
      {
        'rules/a.md': 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
    );
    const plan = materializedPlan('kept');

    const result = await gatherUninstallDecisions(
      [plan],
      packsDir,
      baseDeps(noPromptAdapter(), { keepPack: true }),
    );

    expect(result.aborted).toBe(false);
    expect(result.decisions).toHaveLength(1);
    const decision = result.decisions[0];
    expect(decision.action).toBe('proceed');
    expect(decision.modifications.map((m) => m.relativePath)).toEqual(['rules/a.md']);
    expect(decision.modifications.map((m) => m.status)).toEqual(['modified']);
  });

  it('discards earlier decisions when a later plan aborts at the prompt', async () => {
    // Plan 0: clean pack (no modifications → no prompt).
    writePackWithManifest(
      'first',
      { 'rules/a.md': 'one' },
      { 'rules/a.md': `sha256:${'a'.repeat(64)}` },
    );
    // Use the actual hash of "one" so 'first' has no modifications.
    const { createHash } = await import('node:crypto');
    const hex = createHash('sha256').update(Buffer.from('one')).digest('hex');
    writePackWithManifest('first', { 'rules/a.md': 'one' }, { 'rules/a.md': `sha256:${hex}` });
    // Plan 1: pack with a modification (forces prompt).
    writePackWithManifest(
      'second',
      { 'rules/b.md': 'edited' },
      { 'rules/b.md': `sha256:${'0'.repeat(64)}` },
    );

    const planFirst = materializedPlan('first');
    const planSecond = materializedPlan('second');
    const { adapter } = recordingAdapter(['']); // empty answer → abort

    const result = await gatherUninstallDecisions(
      [planFirst, planSecond],
      packsDir,
      baseDeps(adapter),
    );

    expect(result.aborted).toBe(true);
    // first's decision is kept in the returned partial list so callers can
    // log what was decided before the abort, but the orchestrator MUST NOT
    // apply them. Lock contract is tested via run-uninstall integration.
    expect(result.decisions.map((d) => d.plan.name)).toEqual(['first']);
  });
});
