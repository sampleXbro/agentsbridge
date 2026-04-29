import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';

// ---------- run-install-pack mocks ----------
const mockMaterializePack = vi.hoisted(() => vi.fn());
const mockFindExistingPack = vi.hoisted(() => vi.fn());
const mockReadPackMetadata = vi.hoisted(() => vi.fn());
const mockMergeIntoPack = vi.hoisted(() => vi.fn());
const mockCleanInstallCache = vi.hoisted(() => vi.fn());
const mockUpsertInstallManifestEntry = vi.hoisted(() => vi.fn());
const mockBuildInstallManifestEntry = vi.hoisted(() => vi.fn());
const mockExists = vi.hoisted(() => vi.fn());
const mockRename = vi.hoisted(() => vi.fn());

vi.mock('../../../src/install/pack/pack-writer.js', () => ({
  materializePack: mockMaterializePack,
}));
vi.mock('../../../src/install/pack/pack-reader.js', () => ({
  findExistingPack: mockFindExistingPack,
  readPackMetadata: mockReadPackMetadata,
}));
vi.mock('../../../src/install/pack/pack-merge.js', () => ({
  mergeIntoPack: mockMergeIntoPack,
}));
vi.mock('../../../src/install/pack/cache-cleanup.js', () => ({
  cleanInstallCache: mockCleanInstallCache,
}));
vi.mock('../../../src/install/core/install-manifest.js', () => ({
  upsertInstallManifestEntry: mockUpsertInstallManifestEntry,
  buildInstallManifestEntry: mockBuildInstallManifestEntry,
}));
vi.mock('../../../src/utils/filesystem/fs.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, exists: mockExists };
});
vi.mock('node:fs/promises', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, rename: mockRename };
});

import { installAsPack } from '../../../src/install/run/run-install-pack.js';

function emptyCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

const baseArgs = {
  canonicalDir: '/p/.agentsmesh',
  packName: 'auto-name',
  narrowed: emptyCanonical(),
  selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
  sourceForYaml: 'github:org/repo@abc',
  version: 'abc',
  sourceKind: 'github' as const,
  entryFeatures: ['skills'] as ['skills'],
  pick: undefined,
  yamlTarget: undefined,
  pathInRepo: undefined,
  manualAs: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMaterializePack.mockResolvedValue({ name: 'auto-name' });
  mockFindExistingPack.mockResolvedValue(null);
  mockReadPackMetadata.mockResolvedValue(null);
  mockMergeIntoPack.mockResolvedValue({
    name: 'auto-name',
    features: ['skills'],
    pick: undefined,
  });
  mockCleanInstallCache.mockResolvedValue(undefined);
  mockUpsertInstallManifestEntry.mockResolvedValue(undefined);
  mockBuildInstallManifestEntry.mockImplementation((entry) => entry);
  mockExists.mockResolvedValue(false);
  mockRename.mockResolvedValue(undefined);
});

describe('installAsPack — branches', () => {
  it('throws when materialize would collide with an existing incompatible pack', async () => {
    mockReadPackMetadata.mockResolvedValueOnce({ name: 'auto-name' });
    await expect(installAsPack(baseArgs)).rejects.toThrow(/collides with an existing/);
    expect(mockMaterializePack).not.toHaveBeenCalled();
  });

  it('renames existing pack when renameExistingPack=true and names differ', async () => {
    mockFindExistingPack.mockResolvedValueOnce({
      meta: { name: 'old-name', features: ['skills'] },
      packDir: '/p/.agentsmesh/packs/old-name',
      name: 'old-name',
    });
    mockMergeIntoPack.mockResolvedValueOnce({
      name: 'auto-name',
      features: ['skills'],
      pick: undefined,
    });
    await installAsPack({ ...baseArgs, renameExistingPack: true });
    expect(mockRename).toHaveBeenCalledOnce();
    expect(mockMergeIntoPack).toHaveBeenCalledOnce();
  });

  it('throws when rename target dir already exists', async () => {
    mockFindExistingPack.mockResolvedValueOnce({
      meta: { name: 'old-name', features: ['skills'] },
      packDir: '/p/.agentsmesh/packs/old-name',
      name: 'old-name',
    });
    mockExists.mockResolvedValueOnce(true);
    await expect(installAsPack({ ...baseArgs, renameExistingPack: true })).rejects.toThrow(
      /collides with an existing/,
    );
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('passes pathInRepo=undefined to materialize as path:undefined,paths:undefined', async () => {
    await installAsPack({ ...baseArgs, pathInRepo: undefined });
    const [, , , metadata] = mockMaterializePack.mock.calls[0] as unknown[];
    expect((metadata as Record<string, unknown>).path).toBeUndefined();
    expect((metadata as Record<string, unknown>).paths).toBeUndefined();
  });
});

// ---------- run-install-execute coverage ----------
describe('executeRunInstallPoolsAndWrite — dry-run pack branch', () => {
  // We mock heavy dependencies to exercise dry-run path with default install (not extends).
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns early in dry-run when not using extends and not actually writing pack', async () => {
    vi.doMock('../../../src/canonical/extends/extends.js', () => ({
      loadCanonicalWithExtends: vi.fn().mockResolvedValue({
        canonical: emptyCanonical(),
        resolvedExtends: [],
      }),
    }));
    vi.doMock('../../../src/install/core/install-conflicts.js', () => ({
      resolveInstallConflicts: vi.fn().mockResolvedValue({
        skillNames: [],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      }),
    }));
    vi.doMock('../../../src/install/core/install-extend-entry.js', () => ({
      writeInstallAsExtend: vi.fn(),
    }));
    vi.doMock('../../../src/install/run/run-install-pack.js', () => ({
      installAsPack: vi.fn(),
    }));
    vi.doMock('../../../src/cli/commands/generate.js', () => ({
      runGenerate: vi.fn().mockResolvedValue(0),
    }));
    const loggerInfo = vi.fn();
    const loggerWarn = vi.fn();
    vi.doMock('../../../src/utils/output/logger.js', () => ({
      logger: { info: loggerInfo, warn: loggerWarn, success: vi.fn() },
    }));
    vi.doMock('../../../src/install/core/pool-resolution.js', () => ({
      hasInstallableResources: () => true,
      resolveSkillPool: vi
        .fn()
        .mockResolvedValue([
          { source: '/s/SKILL.md', name: 'demo', description: '', body: '', supportingFiles: [] },
        ]),
      resolveRulePool: vi.fn().mockResolvedValue([]),
      resolveCommandPool: vi.fn().mockResolvedValue([]),
      resolveAgentPool: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../../../src/install/core/install-entry-selection.js', () => ({
      buildInstallPick: vi.fn(),
      deriveInstallFeatures: vi.fn().mockReturnValue(['skills']),
      ensureInstallSelection: vi.fn(),
      pickForSelectedResources: vi.fn().mockReturnValue(undefined),
    }));
    vi.doMock('../../../src/install/core/install-name.js', () => ({
      selectInstallEntryName: vi.fn().mockReturnValue('demo-pack'),
    }));
    vi.doMock('../../../src/install/run/install-replay.js', () => ({
      applyReplayInstallScope: vi.fn().mockImplementation((narrowed, features) => ({
        narrowed,
        discoveredFeatures: features,
      })),
    }));

    const mod = await import('../../../src/install/run/run-install-execute.js');

    const args = {
      scope: 'project' as const,
      force: true,
      dryRun: true,
      tty: false,
      useExtends: false,
      nameOverride: '',
      explicitAs: undefined,
      config: {
        version: 1,
        targets: ['claude-code'],
        features: ['skills'],
        extends: [],
        overrides: {},
      } as never,
      context: { configDir: '/p', canonicalDir: '/p/.agentsmesh', rootBase: '/p' },
      parsed: { kind: 'github', org: 'org', repo: 'repo' } as never,
      sourceForYaml: 'github:org/repo@abc',
      version: 'abc',
      pathInRepo: '',
      persisted: { pathInRepo: undefined, pick: undefined },
      replay: undefined,
      prep: { yamlTarget: undefined } as never,
      implicitPick: undefined,
      narrowed: emptyCanonical({
        skills: [
          { source: '/s/SKILL.md', name: 'demo', description: '', body: '', supportingFiles: [] },
        ],
      }),
      discoveredFeatures: ['skills'],
    };
    await mod.executeRunInstallPoolsAndWrite(args);
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('[dry-run] Would install pack'),
    );
  });

  it('warns when generate fails after install', async () => {
    vi.doMock('../../../src/canonical/extends/extends.js', () => ({
      loadCanonicalWithExtends: vi.fn().mockResolvedValue({
        canonical: emptyCanonical(),
        resolvedExtends: [],
      }),
    }));
    vi.doMock('../../../src/install/core/install-conflicts.js', () => ({
      resolveInstallConflicts: vi.fn().mockResolvedValue({
        skillNames: ['demo'],
        ruleSlugs: [],
        commandNames: [],
        agentNames: [],
      }),
    }));
    vi.doMock('../../../src/install/core/install-extend-entry.js', () => ({
      writeInstallAsExtend: vi.fn(),
    }));
    vi.doMock('../../../src/install/run/run-install-pack.js', () => ({
      installAsPack: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../../src/cli/commands/generate.js', () => ({
      runGenerate: vi.fn().mockResolvedValue(1),
    }));
    const loggerWarn = vi.fn();
    vi.doMock('../../../src/utils/output/logger.js', () => ({
      logger: { info: vi.fn(), warn: loggerWarn, success: vi.fn() },
    }));
    vi.doMock('../../../src/install/core/pool-resolution.js', () => ({
      hasInstallableResources: () => true,
      resolveSkillPool: vi
        .fn()
        .mockResolvedValue([
          { source: '/s/SKILL.md', name: 'demo', description: '', body: '', supportingFiles: [] },
        ]),
      resolveRulePool: vi.fn().mockResolvedValue([]),
      resolveCommandPool: vi.fn().mockResolvedValue([]),
      resolveAgentPool: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../../../src/install/core/install-entry-selection.js', () => ({
      buildInstallPick: vi.fn(),
      deriveInstallFeatures: vi.fn().mockReturnValue(['skills']),
      ensureInstallSelection: vi.fn(),
      pickForSelectedResources: vi.fn().mockReturnValue(undefined),
    }));
    vi.doMock('../../../src/install/core/install-name.js', () => ({
      selectInstallEntryName: vi.fn().mockReturnValue('demo-pack'),
    }));
    vi.doMock('../../../src/install/run/install-replay.js', () => ({
      applyReplayInstallScope: vi.fn().mockImplementation((narrowed, features) => ({
        narrowed,
        discoveredFeatures: features,
      })),
    }));

    const mod = await import('../../../src/install/run/run-install-execute.js');

    const args = {
      scope: 'global' as const,
      force: true,
      dryRun: false,
      tty: false,
      useExtends: false,
      nameOverride: '',
      explicitAs: undefined,
      config: {
        version: 1,
        targets: ['claude-code'],
        features: ['skills'],
        extends: [],
        overrides: {},
      } as never,
      context: {
        configDir: '/home/.agentsmesh',
        canonicalDir: '/home/.agentsmesh',
        rootBase: '/home',
      },
      parsed: { kind: 'github', org: 'org', repo: 'repo' } as never,
      sourceForYaml: 'github:org/repo@abc',
      version: 'abc',
      pathInRepo: '',
      persisted: { pathInRepo: undefined, pick: undefined },
      replay: undefined,
      prep: { yamlTarget: undefined } as never,
      implicitPick: undefined,
      narrowed: emptyCanonical({
        skills: [
          { source: '/s/SKILL.md', name: 'demo', description: '', body: '', supportingFiles: [] },
        ],
      }),
      discoveredFeatures: ['skills'],
    };
    await mod.executeRunInstallPoolsAndWrite(args);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('agentsmesh generate --global'),
    );
  });

  it('throws when narrowed has no installable resources (with implicitPick message branch)', async () => {
    vi.doMock('../../../src/install/core/pool-resolution.js', () => ({
      hasInstallableResources: () => false,
      resolveSkillPool: vi.fn(),
      resolveRulePool: vi.fn(),
      resolveCommandPool: vi.fn(),
      resolveAgentPool: vi.fn(),
    }));
    vi.doMock('../../../src/install/run/install-replay.js', () => ({
      applyReplayInstallScope: vi.fn().mockImplementation((narrowed, features) => ({
        narrowed,
        discoveredFeatures: features,
      })),
    }));

    const mod = await import('../../../src/install/run/run-install-execute.js');

    const args = {
      scope: 'project' as const,
      force: true,
      dryRun: false,
      tty: false,
      useExtends: false,
      nameOverride: '',
      explicitAs: undefined,
      config: {} as never,
      context: { configDir: '/p', canonicalDir: '/p/.agentsmesh', rootBase: '/p' },
      parsed: {} as never,
      sourceForYaml: 'github:org/repo@abc',
      version: 'abc',
      pathInRepo: '',
      persisted: { pathInRepo: undefined, pick: undefined },
      replay: undefined,
      prep: { yamlTarget: undefined } as never,
      implicitPick: { skills: ['x'] } as never,
      narrowed: emptyCanonical(),
      discoveredFeatures: [],
    };

    await expect(mod.executeRunInstallPoolsAndWrite(args)).rejects.toThrow(
      /No resources match the install path or implicit selection/,
    );
  });
});
