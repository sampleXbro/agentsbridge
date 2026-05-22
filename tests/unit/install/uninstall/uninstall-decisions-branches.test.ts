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
  tmp = join(tmpdir(), `udb-${process.pid}-${Date.now()}-${Math.random()}`);
  packsDir = join(tmp, 'packs');
  mkdirSync(packsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function entry(name: string): InstallManifestEntry {
  return {
    name,
    source: `github:acme/${name}`,
    source_kind: 'github',
    features: ['rules'],
  };
}

function plan(name: string): UninstallRemovalPlan {
  return {
    name,
    packDir: join(packsDir, name),
    manifestEntry: entry(name),
    extendsEntry: null,
    removeGenerated: true,
    warnings: [],
  };
}

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

function seedPackYaml(packName: string): void {
  const dir = join(packsDir, packName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'pack.yaml'),
    [
      `name: ${packName}`,
      `source: github:acme/${packName}@abc`,
      'source_kind: github',
      'installed_at: "2026-01-01T00:00:00.000Z"',
      'updated_at: "2026-01-01T00:00:00.000Z"',
      'features:',
      '  - rules',
      'content_hash: sha256:fake',
      '',
    ].join('\n'),
  );
}

describe('gatherUninstallDecisions — branch gaps', () => {
  it('emits warning and proceeds when the pack directory is missing on disk', async () => {
    const warnings: string[] = [];
    const result = await gatherUninstallDecisions(
      [plan('vanished')],
      packsDir,
      deps({ warn: (m) => warnings.push(m) }),
    );
    expect(result.aborted).toBe(false);
    expect(result.decisions[0]!.packDirMissing).toBe(true);
    expect(result.decisions[0]!.action).toBe('proceed');
    expect(warnings.some((w) => w.includes('vanished'))).toBe(true);
  });

  it('proceeds when install manifest JSON is malformed (treats as no recorded files)', async () => {
    seedPackYaml('bad-manifest');
    writeFileSync(
      join(packsDir, 'bad-manifest', INSTALL_MANIFEST_FILENAME),
      '{ this is not valid json',
    );
    const result = await gatherUninstallDecisions([plan('bad-manifest')], packsDir, deps());
    expect(result.aborted).toBe(false);
    expect(result.decisions[0]!.action).toBe('proceed');
    expect(result.decisions[0]!.modifications).toEqual([]);
    // Legacy migration runs before manifest read but won't overwrite the existing file.
    expect(result.decisions[0]!.legacyMigrated).toBe(false);
  });

  it('proceeds with empty modifications when manifest has no `files` map', async () => {
    seedPackYaml('no-files');
    writeFileSync(
      join(packsDir, 'no-files', INSTALL_MANIFEST_FILENAME),
      JSON.stringify({ name: 'no-files', source: 'github:acme/no-files' }),
    );
    const result = await gatherUninstallDecisions([plan('no-files')], packsDir, deps());
    expect(result.aborted).toBe(false);
    expect(result.decisions[0]!.modifications).toEqual([]);
    expect(result.decisions[0]!.action).toBe('proceed');
  });
});
