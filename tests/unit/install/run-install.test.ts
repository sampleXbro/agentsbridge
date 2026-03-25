import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';

const mockLoadConfigFromDir = vi.hoisted(() => vi.fn());
const mockParseInstallSource = vi.hoisted(() => vi.fn());
const mockResolveInstallResolvedPath = vi.hoisted(() => vi.fn());
const mockExists = vi.hoisted(() => vi.fn());
const mockResolveDiscoveredForInstall = vi.hoisted(() => vi.fn());
const mockLoadCanonicalWithExtends = vi.hoisted(() => vi.fn());
const mockResolveInstallConflicts = vi.hoisted(() => vi.fn());
const mockSuggestExtendName = vi.hoisted(() => vi.fn());
const mockWriteInstallAsExtend = vi.hoisted(() => vi.fn());
const mockInstallAsPack = vi.hoisted(() => vi.fn());
const mockRunGenerate = vi.hoisted(() => vi.fn());
const mockIsGitAvailable = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockMaybeRunInstallSync = vi.hoisted(() => vi.fn());

vi.mock('../../../src/config/loader.js', () => ({ loadConfigFromDir: mockLoadConfigFromDir }));
vi.mock('../../../src/install/url-parser.js', () => ({
  parseInstallSource: mockParseInstallSource,
}));
vi.mock('../../../src/install/run-install-resolve.js', () => ({
  resolveInstallResolvedPath: mockResolveInstallResolvedPath,
}));
vi.mock('../../../src/utils/fs.js', () => ({ exists: mockExists }));
vi.mock('../../../src/install/run-install-discovery.js', () => ({
  resolveDiscoveredForInstall: mockResolveDiscoveredForInstall,
}));
vi.mock('../../../src/canonical/extends.js', () => ({
  loadCanonicalWithExtends: mockLoadCanonicalWithExtends,
}));
vi.mock('../../../src/install/install-conflicts.js', () => ({
  resolveInstallConflicts: mockResolveInstallConflicts,
}));
vi.mock('../../../src/install/name-generator.js', () => ({
  suggestExtendName: mockSuggestExtendName,
}));
vi.mock('../../../src/install/install-extend-entry.js', () => ({
  writeInstallAsExtend: mockWriteInstallAsExtend,
}));
vi.mock('../../../src/install/run-install-pack.js', () => ({ installAsPack: mockInstallAsPack }));
vi.mock('../../../src/cli/commands/generate.js', () => ({ runGenerate: mockRunGenerate }));
vi.mock('../../../src/install/git-pin.js', () => ({ isGitAvailable: mockIsGitAvailable }));
vi.mock('../../../src/install/install-sync.js', () => ({
  maybeRunInstallSync: mockMaybeRunInstallSync,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { warn: mockLoggerWarn, info: vi.fn(), success: vi.fn() },
}));

import { runInstall } from '../../../src/install/run-install.js';

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

const CONFIG = {
  version: 1 as const,
  targets: ['claude-code'],
  features: ['rules', 'skills', 'mcp', 'permissions', 'hooks', 'ignore'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge' as const, lock_features: [] },
};

beforeEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  vi.clearAllMocks();
  mockLoadConfigFromDir.mockResolvedValue({ config: CONFIG, configDir: '/project' });
  mockParseInstallSource.mockResolvedValue({
    kind: 'local',
    pathInRepo: '',
    localRoot: '/upstream',
  });
  mockResolveInstallResolvedPath.mockResolvedValue({
    resolvedPath: '/upstream',
    sourceForYaml: '../upstream',
  });
  mockExists.mockResolvedValue(true);
  mockResolveDiscoveredForInstall.mockResolvedValue({
    prep: { yamlTarget: undefined },
    implicitPick: undefined,
    narrowed: canonical({
      skills: [
        {
          source: '/upstream/skills/demo/SKILL.md',
          name: 'demo',
          description: 'Demo',
          body: '',
          supportingFiles: [],
        },
      ],
      mcp: { mcpServers: { context7: { type: 'stdio', command: 'npx', args: ['ctx'], env: {} } } },
      ignore: ['dist'],
    }),
    discoveredFeatures: ['skills', 'mcp', 'ignore'],
  });
  mockLoadCanonicalWithExtends.mockResolvedValue({ canonical: canonical(), resolvedExtends: [] });
  mockResolveInstallConflicts.mockResolvedValue({
    skillNames: ['demo'],
    ruleSlugs: [],
    commandNames: [],
    agentNames: [],
  });
  mockSuggestExtendName.mockReturnValue('demo-pack');
  mockWriteInstallAsExtend.mockResolvedValue(undefined);
  mockInstallAsPack.mockResolvedValue(undefined);
  mockRunGenerate.mockResolvedValue(0);
  mockIsGitAvailable.mockResolvedValue(true);
  mockMaybeRunInstallSync.mockResolvedValue(false);
});

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
});

describe('runInstall', () => {
  it('throws when source is missing', async () => {
    await expect(runInstall({}, [], '/project')).rejects.toThrow('Missing source');
  });

  it('does not require a source when --sync is set', async () => {
    mockMaybeRunInstallSync.mockResolvedValue(true);

    await expect(runInstall({ sync: true, force: true }, [], '/project')).resolves.toBeUndefined();
    expect(mockMaybeRunInstallSync).toHaveBeenCalledOnce();
    expect(mockParseInstallSource).not.toHaveBeenCalled();
    expect(mockResolveInstallResolvedPath).not.toHaveBeenCalled();
    expect(mockResolveDiscoveredForInstall).not.toHaveBeenCalled();
    expect(mockInstallAsPack).not.toHaveBeenCalled();
    expect(mockWriteInstallAsExtend).not.toHaveBeenCalled();
    expect(mockRunGenerate).not.toHaveBeenCalled();
  });

  it('replays sync installs without forcing validation when --force is not set', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    mockMaybeRunInstallSync
      .mockImplementationOnce(async ({ reinstall }) => {
        await reinstall({ name: 'saved-pack', source: '../upstream' });
        return true;
      })
      .mockResolvedValue(false);

    await expect(runInstall({ sync: true }, [], '/project')).rejects.toThrow(
      'Non-interactive terminal',
    );
    expect(mockMaybeRunInstallSync).toHaveBeenCalledTimes(2);
    expect(mockParseInstallSource).not.toHaveBeenCalled();
    expect(mockResolveInstallResolvedPath).not.toHaveBeenCalled();
    expect(mockResolveDiscoveredForInstall).not.toHaveBeenCalled();
    expect(mockInstallAsPack).not.toHaveBeenCalled();
    expect(mockWriteInstallAsExtend).not.toHaveBeenCalled();
    expect(mockRunGenerate).not.toHaveBeenCalled();
  });

  it('throws in non-interactive mode without --force or --dry-run', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    await expect(runInstall({}, ['../upstream'], '/project')).rejects.toThrow(
      'Non-interactive terminal',
    );
  });

  it('installs packs by default and runs generate', async () => {
    await runInstall({ force: true }, ['../upstream'], '/project');
    expect(mockInstallAsPack).toHaveBeenCalledOnce();
    expect(mockInstallAsPack).toHaveBeenCalledWith(
      expect.objectContaining({
        configDir: '/project',
        packName: 'demo-pack',
        sourceForYaml: '../upstream',
        entryFeatures: ['skills', 'mcp', 'ignore'],
      }),
    );
    expect(mockRunGenerate).toHaveBeenCalledWith({}, '/project');
  });

  it('writes extends instead of packs when --extends is set', async () => {
    await runInstall({ force: true, extends: true }, ['../upstream'], '/project');
    expect(mockWriteInstallAsExtend).toHaveBeenCalledOnce();
    expect(mockInstallAsPack).not.toHaveBeenCalled();
  });

  it('throws when git is unavailable for remote installs', async () => {
    mockParseInstallSource.mockResolvedValue({
      kind: 'github',
      pathInRepo: '',
      rawRef: 'HEAD',
      org: 'org',
      repo: 'repo',
    });
    mockIsGitAvailable.mockResolvedValue(false);

    await expect(
      runInstall({ force: true }, ['https://github.com/org/repo'], '/project'),
    ).rejects.toThrow('git is required for remote installs');
  });

  it('throws when the requested install path does not exist', async () => {
    mockParseInstallSource.mockResolvedValue({
      kind: 'local',
      pathInRepo: 'missing',
      localRoot: '/upstream',
    });
    mockExists.mockResolvedValue(false);

    await expect(runInstall({ force: true }, ['../upstream'], '/project')).rejects.toThrow(
      'Install path does not exist: /upstream/missing',
    );
  });

  it('throws when no supported resources are discovered', async () => {
    mockResolveDiscoveredForInstall.mockResolvedValue({
      prep: { yamlTarget: undefined },
      implicitPick: undefined,
      narrowed: canonical(),
      discoveredFeatures: [],
    });
    await expect(runInstall({ force: true }, ['../upstream'], '/project')).rejects.toThrow(
      'No supported resources found to install',
    );
  });

  it('throws when conflict resolution leaves nothing selected', async () => {
    mockResolveInstallConflicts.mockResolvedValue({
      skillNames: [],
      ruleSlugs: [],
      commandNames: [],
      agentNames: [],
    });
    await expect(runInstall({}, ['../upstream'], '/project')).rejects.toThrow(
      'No skills selected to install.',
    );
  });

  it('warns when generate fails after a successful install', async () => {
    mockRunGenerate.mockResolvedValue(1);
    await runInstall({ force: true }, ['../upstream'], '/project');
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Generate failed after install. Fix the issue and run agentsbridge generate.',
    );
  });

  it('materializes only replay-scoped features during sync reinstall', async () => {
    await runInstall({ force: true, sync: true }, ['../upstream'], '/project', {
      features: ['skills'],
    });

    expect(mockInstallAsPack).toHaveBeenCalledOnce();
    expect(mockInstallAsPack).toHaveBeenCalledWith(
      expect.objectContaining({
        entryFeatures: ['skills'],
        narrowed: canonical({
          skills: [
            {
              source: '/upstream/skills/demo/SKILL.md',
              name: 'demo',
              description: 'Demo',
              body: '',
              supportingFiles: [],
            },
          ],
          mcp: null,
          ignore: [],
        }),
      }),
    );
  });
});
