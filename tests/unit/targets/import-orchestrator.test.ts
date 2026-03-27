import { dirname } from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importFileDirectory } from '../../../src/targets/import/import-orchestrator.js';

const mockReadDirRecursive = vi.hoisted(() => vi.fn());
const mockReadFileSafe = vi.hoisted(() => vi.fn());
const mockWriteFileAtomic = vi.hoisted(() => vi.fn());
const mockMkdirp = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/filesystem/fs.js', () => ({
  readDirRecursive: mockReadDirRecursive,
  readFileSafe: mockReadFileSafe,
  writeFileAtomic: mockWriteFileAtomic,
  mkdirp: mockMkdirp,
}));

describe('importFileDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports matching files and returns ImportResult entries', async () => {
    const srcDir = '/repo/.cursor/commands';
    const destDir = '/repo/.agentsmesh/commands';
    const srcPath = `${srcDir}/fix.md`;
    const destPath = `${destDir}/fix.md`;

    mockReadDirRecursive.mockResolvedValue([srcPath, `${srcDir}/ignore.txt`]);
    mockReadFileSafe.mockResolvedValue('# fix command');

    const normalize = vi.fn((content: string, sourceFile: string, destinationFile: string) => {
      return `${content}|${sourceFile}|${destinationFile}`;
    });

    const results = await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize,
      mapEntry: ({ srcPath: inputPath, content, normalizeTo }) => {
        expect(inputPath).toBe(srcPath);
        expect(content).toBe('# fix command');
        expect(normalizeTo(destPath)).toBe(`# fix command|${srcPath}|${destPath}`);
        return {
          destPath,
          toPath: '.agentsmesh/commands/fix.md',
          feature: 'commands',
          content: normalizeTo(destPath),
        };
      },
    });

    expect(mockWriteFileAtomic).toHaveBeenCalledWith(
      destPath,
      `# fix command|${srcPath}|${destPath}`,
    );
    expect(mockMkdirp).toHaveBeenCalledWith(dirname(destPath));
    expect(results).toEqual([
      {
        fromTool: 'cursor',
        fromPath: srcPath,
        toPath: '.agentsmesh/commands/fix.md',
        feature: 'commands',
      },
    ]);
  });

  it('skips null mappings and empty file contents', async () => {
    const srcDir = '/repo/.cursor/agents';
    const destDir = '/repo/.agentsmesh/agents';
    const skippedPath = `${srcDir}/skip.md`;
    const emptyPath = `${srcDir}/empty.md`;

    mockReadDirRecursive.mockResolvedValue([skippedPath, emptyPath]);
    mockReadFileSafe.mockImplementation(async (path: string) => {
      if (path === skippedPath) return 'agent body';
      return '';
    });

    const results = await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize: (content) => content,
      mapEntry: ({ srcPath }) => {
        expect(srcPath).toBe(skippedPath);
        return null;
      },
    });

    expect(mockWriteFileAtomic).not.toHaveBeenCalled();
    expect(mockMkdirp).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});
