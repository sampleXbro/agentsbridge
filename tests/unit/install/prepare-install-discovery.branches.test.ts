import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExists = vi.hoisted(() => vi.fn());
const mockDetectNativeFormat = vi.hoisted(() => vi.fn());
const mockValidateTargetMatchesPath = vi.hoisted(() => vi.fn());
const mockPathSupportsNativePick = vi.hoisted(() => vi.fn());
const mockExtendPickHasArrays = vi.hoisted(() => vi.fn());
const mockTargetHintFromNativePath = vi.hoisted(() => vi.fn());
const mockInferImplicitPickFromNativePath = vi.hoisted(() => vi.fn());
const mockIsImplicitPickEmpty = vi.hoisted(() => vi.fn());
const mockStageImportedNativeRepo = vi.hoisted(() => vi.fn());
const mockStageNativeInstallScope = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/filesystem/fs.js', () => ({
  exists: mockExists,
}));

vi.mock('../../../src/config/resolve/native-format-detector.js', () => ({
  detectNativeFormat: mockDetectNativeFormat,
}));

vi.mock('../../../src/install/native/native-path-pick.js', () => ({
  validateTargetMatchesPath: mockValidateTargetMatchesPath,
  pathSupportsNativePick: mockPathSupportsNativePick,
  extendPickHasArrays: mockExtendPickHasArrays,
  targetHintFromNativePath: mockTargetHintFromNativePath,
}));

vi.mock('../../../src/install/native/native-path-pick-infer.js', () => ({
  inferImplicitPickFromNativePath: mockInferImplicitPickFromNativePath,
  isImplicitPickEmpty: mockIsImplicitPickEmpty,
}));

vi.mock('../../../src/install/native/native-install-scope.js', () => ({
  stageImportedNativeRepo: mockStageImportedNativeRepo,
  stageNativeInstallScope: mockStageNativeInstallScope,
}));

describe('prepareInstallDiscovery branch cases', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockDetectNativeFormat.mockReset();
    mockValidateTargetMatchesPath.mockReset();
    mockPathSupportsNativePick.mockReset();
    mockExtendPickHasArrays.mockReset();
    mockTargetHintFromNativePath.mockReset();
    mockInferImplicitPickFromNativePath.mockReset();
    mockIsImplicitPickEmpty.mockReset();
    mockStageImportedNativeRepo.mockReset();
    mockStageNativeInstallScope.mockReset();
    mockValidateTargetMatchesPath.mockImplementation(() => undefined);
    mockPathSupportsNativePick.mockReturnValue(false);
    mockExtendPickHasArrays.mockReturnValue(false);
    mockTargetHintFromNativePath.mockReturnValue(undefined);
    mockIsImplicitPickEmpty.mockReturnValue(false);
  });

  it('throws when the inferred native path target conflicts with auto-detection', async () => {
    mockExists.mockResolvedValue(false);
    mockTargetHintFromNativePath.mockReturnValue('gemini-cli');
    mockDetectNativeFormat.mockResolvedValue('cursor');

    const { prepareInstallDiscovery } =
      await import('../../../src/install/core/prepare-install-discovery.js');

    await expect(
      prepareInstallDiscovery('/repo', '/repo/.gemini/commands', '.gemini/commands', {}),
    ).rejects.toThrow(/Install path suggests native layout "gemini-cli"/);
  });

  it('throws when implicit native picks resolve to an empty selection', async () => {
    mockExists.mockResolvedValue(true);
    mockTargetHintFromNativePath.mockReturnValue('gemini-cli');
    mockPathSupportsNativePick.mockReturnValue(true);
    mockInferImplicitPickFromNativePath.mockResolvedValue({});
    mockIsImplicitPickEmpty.mockReturnValue(true);

    const { prepareInstallDiscovery } =
      await import('../../../src/install/core/prepare-install-discovery.js');

    await expect(
      prepareInstallDiscovery('/repo', '/repo/.agentsmesh', '.agentsmesh/native', {
        explicitTarget: 'gemini-cli',
      }),
    ).rejects.toThrow(/No installable native resources found/);
  });

  it('writes yamlTarget from inferred implicit picks without an explicit target', async () => {
    mockExists.mockResolvedValue(true);
    mockTargetHintFromNativePath.mockReturnValue('gemini-cli');
    mockPathSupportsNativePick.mockReturnValue(true);
    mockInferImplicitPickFromNativePath.mockResolvedValue({ commands: ['review'] });
    mockExtendPickHasArrays.mockReturnValue(true);

    const { prepareInstallDiscovery } =
      await import('../../../src/install/core/prepare-install-discovery.js');

    const result = await prepareInstallDiscovery(
      '/repo',
      '/repo/.agentsmesh',
      '.agentsmesh/native',
      {},
    );

    expect(result).toMatchObject({
      discoveryRoot: '/repo',
      implicitPick: { commands: ['review'] },
      yamlTarget: 'gemini-cli',
      importHappened: false,
    });
  });
});
