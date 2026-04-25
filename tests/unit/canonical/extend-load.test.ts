import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { loadCanonicalForExtend } from '../../../src/canonical/extends/extend-load.js';
import { exists } from '../../../src/utils/filesystem/fs.js';
import { logger } from '../../../src/utils/output/logger.js';
import { isSkillPackLayout } from '../../../src/canonical/load/skill-pack-load.js';
import { loadSkillsAtExtendPath } from '../../../src/canonical/load/skill-pack-load.js';
import { detectNativeFormat } from '../../../src/config/resolve/native-format-detector.js';
import { importNativeToCanonical } from '../../../src/canonical/extends/native-extends-importer.js';
import { loadCanonicalFiles } from '../../../src/canonical/load/loader.js';
import { normalizeSlicePath } from '../../../src/canonical/load/load-canonical-slice.js';
import { loadCanonicalSliceAtPath } from '../../../src/canonical/load/load-canonical-slice.js';
import type { ResolvedExtend } from '../../../src/config/resolve/resolver.js';
import type {
  CanonicalFiles,
  CanonicalRule,
  CanonicalSkill,
  ImportResult,
} from '../../../src/core/types.js';

vi.mock('../../../src/utils/filesystem/fs.js');
vi.mock('../../../src/utils/output/logger.js');
vi.mock('../../../src/canonical/load/skill-pack-load.js');
vi.mock('../../../src/config/resolve/native-format-detector.js');
vi.mock('../../../src/canonical/extends/native-extends-importer.js');
vi.mock('../../../src/canonical/load/loader.js');
vi.mock('../../../src/canonical/load/load-canonical-slice.js');

const mockExists = vi.mocked(exists);
const mockLoggerInfo = vi.spyOn(logger, 'info');
const mockIsSkillPackLayout = vi.mocked(isSkillPackLayout);
const mockLoadSkillsAtExtendPath = vi.mocked(loadSkillsAtExtendPath);
const mockDetectNativeFormat = vi.mocked(detectNativeFormat);
const mockImportNativeToCanonical = vi.mocked(importNativeToCanonical);
const mockLoadCanonicalFiles = vi.mocked(loadCanonicalFiles);
const mockNormalizeSlicePath = vi.mocked(normalizeSlicePath);
const mockLoadCanonicalSliceAtPath = vi.mocked(loadCanonicalSliceAtPath);

function emptyCanonicalFiles(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function mockImportResults(): ImportResult[] {
  return [];
}

function mockSkill(): CanonicalSkill {
  return {
    source: '/path/to/extend/skills/test-skill/SKILL.md',
    name: 'test-skill',
    description: 'test',
    body: 'test',
    supportingFiles: [],
  };
}

function mockRule(): CanonicalRule {
  return {
    source: '/path/to/extend/.agentsmesh/rules/test.md',
    root: false,
    targets: [],
    description: 'test',
    globs: [],
    body: 'test',
  };
}

describe('extend-load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadCanonicalForExtend', () => {
    const baseExtend: ResolvedExtend = {
      name: 'test-extend',
      resolvedPath: '/path/to/extend',
      features: ['rules'],
    };

    it('loads canonical files when .agentsmesh exists', async () => {
      const mockFiles = emptyCanonicalFiles();
      mockExists.mockResolvedValue(true);
      mockLoadCanonicalFiles.mockResolvedValue(mockFiles);

      const result = await loadCanonicalForExtend(baseExtend);

      // Use path.join in expectations: production uses join() to produce
      // platform-correct paths for filesystem ops; tests must match.
      expect(mockExists).toHaveBeenCalledWith(join('/path/to/extend', '.agentsmesh'));
      expect(mockLoadCanonicalFiles).toHaveBeenCalledWith('/path/to/extend');
      expect(result).toEqual(mockFiles);
    });

    it('loads skills when skill pack layout detected', async () => {
      const mockSkills: CanonicalSkill[] = [mockSkill()];
      mockExists.mockResolvedValue(false);
      mockIsSkillPackLayout.mockResolvedValue(true);
      mockLoadSkillsAtExtendPath.mockResolvedValue(mockSkills);

      const result = await loadCanonicalForExtend(baseExtend);

      expect(mockIsSkillPackLayout).toHaveBeenCalledWith('/path/to/extend');
      expect(mockLoadSkillsAtExtendPath).toHaveBeenCalledWith('/path/to/extend');
      expect(result).toEqual({
        rules: [],
        commands: [],
        agents: [],
        skills: mockSkills,
        mcp: null,
        permissions: null,
        hooks: null,
        ignore: [],
      });
    });

    it('imports native format when detected', async () => {
      mockExists.mockResolvedValue(false);
      mockIsSkillPackLayout.mockResolvedValue(false);
      mockDetectNativeFormat.mockResolvedValue('cursor');
      mockImportNativeToCanonical.mockResolvedValue(mockImportResults());
      mockLoadCanonicalFiles.mockResolvedValue(emptyCanonicalFiles());

      await loadCanonicalForExtend(baseExtend);

      expect(mockDetectNativeFormat).toHaveBeenCalledWith('/path/to/extend');
      expect(mockImportNativeToCanonical).toHaveBeenCalledWith('/path/to/extend', 'cursor');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[agentsmesh] Extend "test-extend": detected cursor format, importing to .agentsmesh/...',
      );
    });

    it('uses specified target when provided', async () => {
      const extendWithTarget: ResolvedExtend = {
        ...baseExtend,
        target: 'copilot',
      };
      mockExists.mockResolvedValue(false);
      mockIsSkillPackLayout.mockResolvedValue(false);
      mockImportNativeToCanonical.mockResolvedValue(mockImportResults());
      mockLoadCanonicalFiles.mockResolvedValue(emptyCanonicalFiles());

      await loadCanonicalForExtend(extendWithTarget);

      expect(mockDetectNativeFormat).not.toHaveBeenCalled();
      expect(mockImportNativeToCanonical).toHaveBeenCalledWith('/path/to/extend', 'copilot');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[agentsmesh] Extend "test-extend": specified copilot format, importing to .agentsmesh/...',
      );
    });

    it('throws error when no supported configuration found', async () => {
      mockExists.mockResolvedValue(false);
      mockIsSkillPackLayout.mockResolvedValue(false);
      mockDetectNativeFormat.mockResolvedValue(null);

      await expect(loadCanonicalForExtend(baseExtend)).rejects.toThrow(
        'Extend "test-extend": No supported agent configuration found in /path/to/extend.',
      );
    });

    it('throws error when specified path does not exist', async () => {
      const extendWithPath: ResolvedExtend = {
        ...baseExtend,
        path: 'subdir',
      };
      mockExists.mockResolvedValue(false);

      await expect(loadCanonicalForExtend(extendWithPath)).rejects.toThrow(
        `Extend "test-extend": path does not exist: ${join('/path/to/extend', 'subdir')}`,
      );
    });

    it('imports native format when path with target specified', async () => {
      const extendWithPathAndTarget: ResolvedExtend = {
        ...baseExtend,
        path: 'subdir',
        target: 'windsurf',
      };
      const mockFiles = emptyCanonicalFiles();
      mockExists
        .mockResolvedValueOnce(true) // path existence check for subdir
        .mockResolvedValueOnce(false); // .agentsmesh check at extend root
      mockImportNativeToCanonical.mockResolvedValue(mockImportResults());
      mockLoadCanonicalFiles.mockResolvedValue(mockFiles);

      await loadCanonicalForExtend(extendWithPathAndTarget);

      expect(mockImportNativeToCanonical).toHaveBeenCalledWith('/path/to/extend', 'windsurf');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[agentsmesh] Extend "test-extend": path "subdir" with target "windsurf" — importing at extend root, then loading canonical.',
      );
    });

    it('loads canonical slice when path without target', async () => {
      const extendWithPath: ResolvedExtend = {
        ...baseExtend,
        path: 'subdir',
      };
      const mockSlice: CanonicalFiles = {
        ...emptyCanonicalFiles(),
        rules: [mockRule()],
      };
      mockExists.mockResolvedValue(true);
      mockNormalizeSlicePath.mockResolvedValue({ sliceRoot: '/path/to/extend/subdir' });
      mockLoadCanonicalSliceAtPath.mockResolvedValue(mockSlice);

      const result = await loadCanonicalForExtend(extendWithPath);

      // Production uses join(base, ext.path) — Windows produces backslashes.
      expect(mockNormalizeSlicePath).toHaveBeenCalledWith(join('/path/to/extend', 'subdir'));
      // Mock returned the POSIX sliceRoot above, so this assertion matches the mock value verbatim.
      expect(mockLoadCanonicalSliceAtPath).toHaveBeenCalledWith('/path/to/extend/subdir');
      expect(result).toEqual(mockSlice);
    });

    it('handles slice loading errors', async () => {
      const extendWithPath: ResolvedExtend = {
        ...baseExtend,
        path: 'subdir',
      };
      mockExists.mockResolvedValue(true);
      mockNormalizeSlicePath.mockResolvedValue({ sliceRoot: '/path/to/extend/subdir' });
      mockLoadCanonicalSliceAtPath.mockRejectedValue(new Error('Slice load failed'));

      await expect(loadCanonicalForExtend(extendWithPath)).rejects.toThrow('Slice load failed');
    });
  });
});
