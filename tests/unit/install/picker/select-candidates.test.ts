import { describe, it, expect } from 'vitest';
import {
  selectInstallCandidates,
  type SelectCandidatesOpts,
} from '../../../../src/install/picker/select-candidates.js';
import type { SourceLayout } from '../../../../src/install/classify/layout-types.js';

function emptyLayout(): SourceLayout {
  return {
    canonical: null,
    skillPack: null,
    rootSkill: null,
    rootRule: null,
    flatCollections: [],
    toolNativeManifests: [],
    subPacks: [],
  };
}

function baseOpts(layout: SourceLayout): SelectCandidatesOpts {
  return {
    layout,
    sourceName: 'test-repo',
    sourceForYaml: 'github:test/repo@abc',
  };
}

describe('selectInstallCandidates', () => {
  describe('explicit flags short-circuit', () => {
    it('returns empty when --path is set', () => {
      const result = selectInstallCandidates({
        ...baseOpts(emptyLayout()),
        explicitPath: 'some/path',
      });
      expect(result.targets).toHaveLength(0);
      expect(result.isMarketplace).toBe(false);
    });

    it('returns empty when --as is set', () => {
      const result = selectInstallCandidates({
        ...baseOpts(emptyLayout()),
        explicitAs: 'rules',
      });
      expect(result.targets).toHaveLength(0);
    });

    it('returns empty when --target is set', () => {
      const result = selectInstallCandidates({
        ...baseOpts(emptyLayout()),
        explicitTarget: 'claude-code',
      });
      expect(result.targets).toHaveLength(0);
    });
  });

  describe('canonical / skillPack passthrough', () => {
    it('returns empty for canonical layout', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        canonical: { path: '.agentsmesh' },
      };
      const result = selectInstallCandidates(baseOpts(layout));
      expect(result.targets).toHaveLength(0);
    });

    it('returns empty for skillPack layout', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        skillPack: { path: 'skills' },
      };
      const result = selectInstallCandidates(baseOpts(layout));
      expect(result.targets).toHaveLength(0);
    });
  });

  describe('single flat collection → auto-pick', () => {
    it('auto-picks a single commands collection', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        flatCollections: [{ path: 'commands', suggestedAs: 'commands', fileShape: 'md' }],
      };
      const result = selectInstallCandidates(baseOpts(layout));
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0].as).toBe('commands');
      expect(result.targets[0].path).toBe('commands');
      expect(result.targets[0].features).toEqual(['commands']);
      expect(result.isMarketplace).toBe(false);
    });

    it('auto-picks a single rules collection', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        flatCollections: [{ path: 'rules', suggestedAs: 'rules', fileShape: 'md' }],
      };
      const result = selectInstallCandidates(baseOpts(layout));
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0].as).toBe('rules');
    });
  });

  describe('multiple flat collections → ambiguous', () => {
    it('throws structured error with --force', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        flatCollections: [
          { path: 'rules', suggestedAs: 'rules', fileShape: 'md' },
          { path: 'commands', suggestedAs: 'commands', fileShape: 'md' },
        ],
      };
      expect(() => selectInstallCandidates({ ...baseOpts(layout), force: true })).toThrow(
        /Ambiguous source/,
      );
    });

    it('throws structured error without TTY', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        flatCollections: [
          { path: 'rules', suggestedAs: 'rules', fileShape: 'md' },
          { path: 'commands', suggestedAs: 'commands', fileShape: 'md' },
        ],
      };
      expect(() => selectInstallCandidates({ ...baseOpts(layout), tty: false })).toThrow(
        /Ambiguous source/,
      );
    });

    it('returns all collections when TTY (for future prompt)', () => {
      const layout: SourceLayout = {
        ...emptyLayout(),
        flatCollections: [
          { path: 'rules', suggestedAs: 'rules', fileShape: 'md' },
          { path: 'commands', suggestedAs: 'commands', fileShape: 'md' },
        ],
      };
      const result = selectInstallCandidates({ ...baseOpts(layout), tty: true });
      expect(result.targets).toHaveLength(2);
    });
  });

  describe('marketplace (subPacks ≥ 2)', () => {
    const marketplaceLayout: SourceLayout = {
      ...emptyLayout(),
      subPacks: [
        {
          path: 'plugins/canvas-apps',
          layout: {
            canonical: null,
            skillPack: { path: 'plugins/canvas-apps/skills' },
            rootSkill: null,
            rootRule: null,
            flatCollections: [],
            toolNativeManifests: [],
          },
        },
        {
          path: 'plugins/code-apps',
          layout: {
            canonical: null,
            skillPack: null,
            rootSkill: null,
            rootRule: null,
            flatCollections: [
              { path: 'plugins/code-apps/agents', suggestedAs: 'agents', fileShape: 'md' },
            ],
            toolNativeManifests: [],
          },
        },
        {
          path: 'plugins/power-pages',
          layout: {
            canonical: null,
            skillPack: { path: 'plugins/power-pages/skills' },
            rootSkill: null,
            rootRule: null,
            flatCollections: [],
            toolNativeManifests: [],
          },
        },
      ],
    };

    it('returns all sub-packs with --all', () => {
      const result = selectInstallCandidates({
        ...baseOpts(marketplaceLayout),
        all: true,
      });
      expect(result.targets).toHaveLength(3);
      expect(result.isMarketplace).toBe(true);
      expect(result.targets[0].name).toBe('test-repo-plugins-canvas-apps');
      expect(result.targets[0].path).toBe('plugins/canvas-apps');
      expect(result.targets[1].name).toBe('test-repo-plugins-code-apps');
      expect(result.targets[2].name).toBe('test-repo-plugins-power-pages');
    });

    it('throws structured error with --force and no --all', () => {
      expect(() =>
        selectInstallCandidates({
          ...baseOpts(marketplaceLayout),
          force: true,
        }),
      ).toThrow(/Marketplace source with 3 sub-packs/);
    });

    it('throws when non-TTY without --all', () => {
      expect(() =>
        selectInstallCandidates({
          ...baseOpts(marketplaceLayout),
          tty: false,
        }),
      ).toThrow(/Marketplace source/);
    });

    it('returns all sub-packs when TTY (for future prompt)', () => {
      const result = selectInstallCandidates({
        ...baseOpts(marketplaceLayout),
        tty: true,
      });
      expect(result.targets).toHaveLength(3);
      expect(result.isMarketplace).toBe(true);
    });

    it('each sub-pack target has features derived from its layout', () => {
      const result = selectInstallCandidates({
        ...baseOpts(marketplaceLayout),
        all: true,
      });
      expect(result.targets[0].features).toContain('skills');
      expect(result.targets[1].features).toContain('agents');
    });
  });

  describe('empty layout', () => {
    it('returns empty targets for empty layout', () => {
      const result = selectInstallCandidates(baseOpts(emptyLayout()));
      expect(result.targets).toHaveLength(0);
      expect(result.isMarketplace).toBe(false);
    });
  });
});
