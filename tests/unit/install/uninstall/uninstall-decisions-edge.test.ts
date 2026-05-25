/**
 * Branch coverage for src/install/uninstall/uninstall-decisions.ts:
 * - Line 60: extends-only plan (manifestEntry === null) short-circuits before
 *   touching disk, returning `proceed` with no modifications.
 * - keepPack-with-modifications path returns proceed without prompting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  gatherUninstallDecisions,
  type UninstallDecisionsDeps,
} from '../../../../src/install/uninstall/uninstall-decisions.js';
import type { UninstallRemovalPlan } from '../../../../src/install/uninstall/plan-uninstall.js';
import { INSTALL_MANIFEST_FILENAME } from '../../../../src/install/manifest/install-manifest-hash.js';
import { hashPackFiles } from '../../../../src/install/manifest/install-manifest-hash.js';
import type { PromptAdapter } from '../../../../src/install/prompts/prompt-types.js';

let tmp: string;
let packsDir: string;

beforeEach(() => {
  tmp = join(tmpdir(), `udb-edge-${process.pid}-${Date.now()}-${Math.random()}`);
  packsDir = join(tmp, 'packs');
  mkdirSync(packsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function noPrompt(): PromptAdapter {
  return {
    ask: async () => {
      throw new Error('should not prompt');
    },
    write: () => {},
  };
}

function deps(overrides: Partial<UninstallDecisionsDeps> = {}): UninstallDecisionsDeps {
  return {
    adapter: noPrompt(),
    warn: () => {},
    bypassPrompts: false,
    keepPack: false,
    ...overrides,
  };
}

describe('gatherUninstallDecisions — edge branches', () => {
  it('proceeds for extends-only plan (manifestEntry === null) without disk access', async () => {
    const plan: UninstallRemovalPlan = {
      name: 'ext-only',
      packDir: null,
      manifestEntry: null,
      extendsEntry: { name: 'ext-only', source: 'github:acme/ext-only' } as never,
      removeGenerated: true,
      warnings: [],
    };
    const result = await gatherUninstallDecisions([plan], packsDir, deps());
    expect(result.aborted).toBe(false);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]!.action).toBe('proceed');
    expect(result.decisions[0]!.modifications).toEqual([]);
    expect(result.decisions[0]!.packDirMissing).toBe(false);
    expect(result.decisions[0]!.legacyMigrated).toBe(false);
  });

  it('with --keep-pack: drift detected but prompt is bypassed (proceed action)', async () => {
    const name = 'modified-keep';
    const packDir = join(packsDir, name);
    mkdirSync(packDir, { recursive: true });
    writeFileSync(join(packDir, 'rules.md'), '# original\n');
    const files = await hashPackFiles(packDir);
    writeFileSync(join(packDir, INSTALL_MANIFEST_FILENAME), JSON.stringify({ files }));
    // Modify the file after recording the manifest → drift.
    writeFileSync(join(packDir, 'rules.md'), '# changed\n');

    const plan: UninstallRemovalPlan = {
      name,
      packDir,
      manifestEntry: {
        name,
        source: 'github:acme/keep',
        source_kind: 'github',
        features: ['rules'],
      },
      extendsEntry: null,
      removeGenerated: true,
      warnings: [],
    };
    const result = await gatherUninstallDecisions([plan], packsDir, deps({ keepPack: true }));
    expect(result.aborted).toBe(false);
    expect(result.decisions[0]!.action).toBe('proceed');
    // Exactly one modification is reported (the single file we mutated), with
    // the correct relative path and `modified` status.
    expect(result.decisions[0]!.modifications).toEqual([
      { relativePath: 'rules.md', status: 'modified' },
    ]);
  });
});
