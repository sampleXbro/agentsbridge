import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  planUninstall,
  type PlanUninstallArgs,
  type UninstallRemovalPlan,
} from '../../../../src/install/uninstall/plan-uninstall.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

type ExtendEntry = ValidatedConfig['extends'][number];

const PACKS_DIR = join(tmpdir(), 'plan-uninstall-test-packs');

function installEntry(
  overrides: Partial<InstallManifestEntry> & { name: string },
): InstallManifestEntry {
  const { name } = overrides;
  return {
    source: `github:acme/${name}@abc`,
    source_kind: 'github',
    features: ['rules'],
    ...overrides,
  };
}

function extendEntry(name: string, source: string): ExtendEntry {
  return {
    name,
    source,
    features: ['rules'],
  };
}

function makeArgs(partial: Partial<PlanUninstallArgs> = {}): PlanUninstallArgs {
  return {
    names: partial.names ?? [],
    all: partial.all ?? false,
    keepPack: partial.keepPack ?? false,
    keepGenerated: partial.keepGenerated ?? false,
    installs: partial.installs ?? [],
    extends: partial.extends ?? [],
    packsDir: partial.packsDir ?? PACKS_DIR,
  };
}

describe('planUninstall - basic single removal', () => {
  it('returns one removal plan for a single named install', () => {
    const entry = installEntry({ name: 'foo' });
    const result = planUninstall(
      makeArgs({
        names: ['foo'],
        installs: [entry],
      }),
    );

    expect(result.skipped).toEqual([]);
    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]).toEqual({
      name: 'foo',
      packDir: join(PACKS_DIR, 'foo'),
      manifestEntry: entry,
      extendsEntry: null,
      removeGenerated: true,
      warnings: [],
    } satisfies UninstallRemovalPlan);
  });

  it('includes the matching extends entry when one exists', () => {
    const entry = installEntry({ name: 'foo' });
    const ext = extendEntry('foo', entry.source);

    const result = planUninstall(makeArgs({ names: ['foo'], installs: [entry], extends: [ext] }));

    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]!.extendsEntry).toBe(ext);
  });
});

describe('planUninstall - --keep-pack', () => {
  it('omits packDir from the plan but still removes yaml and extends entries', () => {
    const entry = installEntry({ name: 'foo' });
    const ext = extendEntry('foo', entry.source);

    const result = planUninstall(
      makeArgs({ names: ['foo'], installs: [entry], extends: [ext], keepPack: true }),
    );

    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]!.packDir).toBeNull();
    expect(result.removals[0]!.manifestEntry).toBe(entry);
    expect(result.removals[0]!.extendsEntry).toBe(ext);
  });
});

describe('planUninstall - --keep-generated', () => {
  it('sets removeGenerated=false and attaches a warning', () => {
    const entry = installEntry({ name: 'foo' });

    const result = planUninstall(
      makeArgs({ names: ['foo'], installs: [entry], keepGenerated: true }),
    );

    expect(result.removals).toHaveLength(1);
    expect(result.removals[0]!.removeGenerated).toBe(false);
    expect(result.removals[0]!.warnings).toHaveLength(1);
    expect(result.removals[0]!.warnings[0]!.toLowerCase()).toContain('generated');
  });
});

describe('planUninstall - --all', () => {
  it('returns one plan per installed pack', () => {
    const a = installEntry({ name: 'a' });
    const b = installEntry({ name: 'b' });
    const c = installEntry({ name: 'c' });

    const result = planUninstall(makeArgs({ all: true, installs: [a, b, c] }));

    expect(result.skipped).toEqual([]);
    expect(result.removals.map((r) => r.name)).toEqual(['a', 'b', 'c']);
  });

  it('ignores user-provided names when --all is set', () => {
    const a = installEntry({ name: 'a' });
    const b = installEntry({ name: 'b' });

    const result = planUninstall(makeArgs({ names: ['nonexistent'], all: true, installs: [a, b] }));

    expect(result.skipped).toEqual([]);
    expect(result.removals.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('throws when the installs list contains duplicate names', () => {
    const a = installEntry({ name: 'dup' });
    const b = installEntry({ name: 'dup', source: 'github:other/dup@xyz' });

    expect(() => planUninstall(makeArgs({ all: true, installs: [a, b] }))).toThrow(/duplicate/i);
  });
});

describe('planUninstall - missing / skipped names', () => {
  it('returns names that do not match any install in skipped', () => {
    const entry = installEntry({ name: 'foo' });

    const result = planUninstall(
      makeArgs({ names: ['foo', 'missing-1', 'missing-2'], installs: [entry] }),
    );

    expect(result.skipped).toEqual(['missing-1', 'missing-2']);
    expect(result.removals.map((r) => r.name)).toEqual(['foo']);
  });

  it('returns all names as skipped when none match', () => {
    const result = planUninstall(makeArgs({ names: ['a', 'b'], installs: [] }));
    expect(result.skipped).toEqual(['a', 'b']);
    expect(result.removals).toEqual([]);
  });
});

describe('planUninstall - duplicate user-provided names', () => {
  it('throws when the same name is requested more than once', () => {
    const entry = installEntry({ name: 'foo' });

    expect(() => planUninstall(makeArgs({ names: ['foo', 'foo'], installs: [entry] }))).toThrow(
      /duplicate/i,
    );
  });
});

describe('planUninstall - input validation', () => {
  it('throws when neither names nor --all is provided', () => {
    expect(() => planUninstall(makeArgs())).toThrow();
  });
});

describe('planUninstall - extends entry resolution', () => {
  it('matches the extends entry by name (not by source) so renames do not strand entries', () => {
    const entry = installEntry({ name: 'foo' });
    const renamedExt = extendEntry('foo', 'github:somewhere/else@old');

    const result = planUninstall(
      makeArgs({ names: ['foo'], installs: [entry], extends: [renamedExt] }),
    );

    expect(result.removals[0]!.extendsEntry).toBe(renamedExt);
  });

  it('leaves extendsEntry=null when no entry shares the install name', () => {
    const entry = installEntry({ name: 'foo' });
    const otherExt = extendEntry('bar', 'github:other/repo@def');

    const result = planUninstall(
      makeArgs({ names: ['foo'], installs: [entry], extends: [otherExt] }),
    );

    expect(result.removals[0]!.extendsEntry).toBeNull();
  });
});
