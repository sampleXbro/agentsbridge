import { beforeEach, describe, expect, it, vi } from 'vitest';
import { skillNamesFromNativeSkillDir } from '../../../src/install/native/native-skill-scan.js';
import { readDirRecursive } from '../../../src/utils/filesystem/fs.js';

vi.mock('../../../src/utils/filesystem/fs.js');
const mockReadDirRecursive = vi.mocked(readDirRecursive);

describe('skillNamesFromNativeSkillDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts skill names from SKILL.md files', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot/skill1/SKILL.md',
      '/scanRoot/skill2/SKILL.md',
      '/scanRoot/nested/skill3/SKILL.md',
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['skill1', 'skill2', 'skill3']);
  });

  it('extracts flat skill names from top-level markdown files', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot/flat-skill.md',
      '/scanRoot/another-skill.MD',
      '/scanRoot/README.md',
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['README', 'another-skill.MD', 'flat-skill']);
  });

  it('combines both SKILL.md and flat skills', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot/skill1/SKILL.md',
      '/scanRoot/flat-skill.md',
      '/scanRoot/skill2/SKILL.md',
      '/scanRoot/another.MD',
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['another.MD', 'flat-skill', 'skill1', 'skill2']);
  });

  it('ignores nested markdown files that are not SKILL.md', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot/nested/not-skill.md',
      '/scanRoot/deep/another.md',
      '/scanRoot/skill1/SKILL.md',
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['skill1']);
  });

  it('handles empty directory', async () => {
    mockReadDirRecursive.mockResolvedValue([]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual([]);
  });

  it('filters out empty names', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot//SKILL.md', // Results in empty dirname
      '/scanRoot/.md', // Results in empty basename
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['.md', 'scanRoot']);
  });

  it('normalizes path separators', async () => {
    mockReadDirRecursive.mockResolvedValue([
      'C:\\scanRoot\\skill1\\SKILL.md',
      'C:\\scanRoot\\skill2\\SKILL.md',
    ]);

    const result = await skillNamesFromNativeSkillDir('C:\\scanRoot');

    expect(result).toEqual([]);
  });

  it('sorts results alphabetically', async () => {
    mockReadDirRecursive.mockResolvedValue([
      '/scanRoot/zebra/SKILL.md',
      '/scanRoot/alpha/SKILL.md',
      '/scanRoot/beta.md',
    ]);

    const result = await skillNamesFromNativeSkillDir('/scanRoot');

    expect(result).toEqual(['alpha', 'beta', 'zebra']);
  });
});
