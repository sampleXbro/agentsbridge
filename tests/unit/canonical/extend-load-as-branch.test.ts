/**
 * Branch-coverage tests for the `ext.as !== undefined` path in
 * loadCanonicalForExtend (src/canonical/extends/extend-load.ts lines 39-50).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { loadCanonicalForExtend } from '../../../src/canonical/extends/extend-load.js';
import { exists } from '../../../src/utils/filesystem/fs.js';
import { loadCanonicalFiles } from '../../../src/canonical/load/loader.js';
import { stageManualInstallScope } from '../../../src/install/manual/manual-install-scope.js';
import type { ResolvedExtend } from '../../../src/config/resolve/resolver.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

vi.mock('../../../src/utils/filesystem/fs.js');
vi.mock('../../../src/canonical/load/loader.js');
vi.mock('../../../src/install/manual/manual-install-scope.js');

const mockExists = vi.mocked(exists);
const mockLoadCanonicalFiles = vi.mocked(loadCanonicalFiles);
const mockStage = vi.mocked(stageManualInstallScope);

function emptyCanonical(): CanonicalFiles {
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

describe('loadCanonicalForExtend — ext.as branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stages and loads canonical files when ext.as is set (no path)', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockStage.mockResolvedValue({ discoveryRoot: '/staged', cleanup });
    mockLoadCanonicalFiles.mockResolvedValue(emptyCanonical());

    const ext: ResolvedExtend = {
      name: 'manual-skills',
      resolvedPath: '/path/to/extend',
      features: ['skills'],
      as: 'skills',
    };

    const result = await loadCanonicalForExtend(ext);

    expect(mockStage).toHaveBeenCalledWith('/path/to/extend', 'skills');
    expect(mockLoadCanonicalFiles).toHaveBeenCalledWith(join('/staged', '.agentsmesh'));
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toEqual(emptyCanonical());
  });

  it('stages and loads canonical files when ext.as is set and ext.path is provided', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockStage.mockResolvedValue({ discoveryRoot: '/staged', cleanup });
    mockLoadCanonicalFiles.mockResolvedValue(emptyCanonical());

    const ext: ResolvedExtend = {
      name: 'manual-rules',
      resolvedPath: '/path/to/extend',
      features: ['rules'],
      as: 'rules',
      path: 'sub',
    };

    await loadCanonicalForExtend(ext);

    expect(mockStage).toHaveBeenCalledWith(join('/path/to/extend', 'sub'), 'rules');
    expect(cleanup).toHaveBeenCalled();
  });

  it('throws when ext.as is set but resolved path does not exist', async () => {
    mockExists.mockResolvedValue(false);

    const ext: ResolvedExtend = {
      name: 'manual-missing',
      resolvedPath: '/missing',
      features: ['skills'],
      as: 'skills',
    };

    await expect(loadCanonicalForExtend(ext)).rejects.toThrow(
      'Extend "manual-missing": path does not exist: /missing',
    );
    expect(mockStage).not.toHaveBeenCalled();
  });

  it('cleans up staged root even when loadCanonicalFiles throws', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockStage.mockResolvedValue({ discoveryRoot: '/staged', cleanup });
    mockLoadCanonicalFiles.mockRejectedValue(new Error('load boom'));

    const ext: ResolvedExtend = {
      name: 'manual-boom',
      resolvedPath: '/path/to/extend',
      features: ['skills'],
      as: 'skills',
    };

    await expect(loadCanonicalForExtend(ext)).rejects.toThrow('load boom');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
