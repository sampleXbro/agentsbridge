import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClassifySource = vi.hoisted(() => vi.fn());
const mockAggregateAnthropicSkillPack = vi.hoisted(() => vi.fn());
const mockResolveDiscoveredForInstall = vi.hoisted(() => vi.fn());
const mockResolveManualDiscoveredForInstall = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/install/classify/classify-source.js', () => ({
  classifySource: mockClassifySource,
}));
vi.mock('../../../../src/sources/anthropic-skill-pack/aggregate.js', () => ({
  aggregateAnthropicSkillPack: mockAggregateAnthropicSkillPack,
}));
vi.mock('../../../../src/sources/anthropic-skill-pack/index.js', () => ({
  anthropicSkillPackSource: {
    id: 'anthropic-skill-pack',
    mergeFromToolDirs: [],
  },
}));
vi.mock('../../../../src/install/run/run-install-discovery.js', () => ({
  resolveDiscoveredForInstall: mockResolveDiscoveredForInstall,
}));
vi.mock('../../../../src/install/manual/manual-install-discovery.js', () => ({
  resolveManualDiscoveredForInstall: mockResolveManualDiscoveredForInstall,
}));

import { resolveInstallDiscovery } from '../../../../src/install/core/install-discovery.js';

function nativeReturn(): unknown {
  return {
    prep: { discoveryRoot: '/content', importHappened: false },
    implicitPick: undefined,
    narrowed: {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    },
    discoveredFeatures: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveDiscoveredForInstall.mockResolvedValue(nativeReturn());
  mockResolveManualDiscoveredForInstall.mockResolvedValue({
    prep: { discoveryRoot: '/content', importHappened: false },
    narrowed: nativeReturn().narrowed,
    discoveredFeatures: [],
  });
});

describe('resolveInstallDiscovery — classifier dispatch', () => {
  it('skips classifier and routes to manual path when --as is set', async () => {
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
      explicitAs: 'skills',
    });
    expect(mockClassifySource).not.toHaveBeenCalled();
    expect(mockResolveManualDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockResolveDiscoveredForInstall).not.toHaveBeenCalled();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });

  it('skips classifier and routes to native path when --target is set', async () => {
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
      explicitTarget: 'claude-code',
    });
    expect(mockClassifySource).not.toHaveBeenCalled();
    expect(mockResolveDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });

  it('classifies and routes to native path when classification is tool-native', async () => {
    mockClassifySource.mockResolvedValue({
      type: 'tool-native',
      score: 0,
      signals: [],
    });
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
    });
    expect(mockClassifySource).toHaveBeenCalledWith('/content');
    expect(mockResolveDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });

  it('classifies and routes to native path when classification is canonical-agentsmesh', async () => {
    mockClassifySource.mockResolvedValue({
      type: 'canonical-agentsmesh',
      score: 0,
      signals: [],
    });
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
    });
    expect(mockResolveDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });

  it('classifies and routes to native path when classification is unknown', async () => {
    mockClassifySource.mockResolvedValue({
      type: 'unknown',
      score: 0,
      signals: [],
    });
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
    });
    expect(mockResolveDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });

  it('classifies and routes to aggregator when classification is anthropic-skill-pack', async () => {
    mockClassifySource.mockResolvedValue({
      type: 'anthropic-skill-pack',
      score: 2.4,
      signals: [],
    });
    mockAggregateAnthropicSkillPack.mockResolvedValue({
      skills: [
        {
          name: 'tdd',
          source: '/content/skills/tdd/SKILL.md',
          description: '',
          body: '',
          supportingFiles: [],
        },
      ],
      agents: [],
      commands: [],
      rules: [],
      dedups: [],
      brokenLinks: [],
    });

    const result = await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
    });

    expect(mockResolveDiscoveredForInstall).not.toHaveBeenCalled();
    expect(mockAggregateAnthropicSkillPack).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).toHaveBeenCalledWith(
      '/content',
      expect.objectContaining({ id: 'anthropic-skill-pack' }),
    );
    expect(result.classification).toEqual({
      type: 'anthropic-skill-pack',
      score: 2.4,
      signals: [],
    });
    expect(result.aggregate).toBeDefined();
    expect(result.narrowed.skills).toHaveLength(1);
    expect(result.narrowed.skills[0]?.name).toBe('tdd');
    expect(result.discoveredFeatures).toEqual(['skills']);
  });

  it('preserves --target override even when source would classify as skill-pack', async () => {
    mockClassifySource.mockResolvedValue({
      type: 'anthropic-skill-pack',
      score: 2.4,
      signals: [],
    });
    await resolveInstallDiscovery({
      resolvedPath: '/repo',
      contentRoot: '/content',
      pathInRepo: '',
      explicitTarget: 'claude-code',
    });
    expect(mockClassifySource).not.toHaveBeenCalled();
    expect(mockResolveDiscoveredForInstall).toHaveBeenCalledOnce();
    expect(mockAggregateAnthropicSkillPack).not.toHaveBeenCalled();
  });
});
