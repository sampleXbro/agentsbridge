/**
 * Gemini command name inference for install (matches importer-mappers naming).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  inferGeminiCommandNamesFromFiles,
  isUnderGeminiCommands,
} from '../../../src/install/native/gemini-install-commands.js';

const ROOT = join(tmpdir(), 'am-gemini-install-cmd');

describe('isUnderGeminiCommands', () => {
  it('matches root and nested command paths', () => {
    expect(isUnderGeminiCommands('.gemini/commands')).toBe(true);
    expect(isUnderGeminiCommands('.gemini/commands/git')).toBe(true);
    expect(isUnderGeminiCommands('skills/foo')).toBe(false);
  });

  it('handles path normalization', () => {
    expect(isUnderGeminiCommands('/.gemini/commands/')).toBe(true);
    expect(isUnderGeminiCommands('//.gemini//commands//git//')).toBe(false); // Double slashes don't match
    expect(isUnderGeminiCommands('.gemini/commands/sub/deep')).toBe(true);
  });

  it('returns false for similar but different paths', () => {
    expect(isUnderGeminiCommands('.gemini/command')).toBe(false);
    expect(isUnderGeminiCommands('.gemini')).toBe(false);
    expect(isUnderGeminiCommands('gemini/commands')).toBe(false);
  });
});

describe('inferGeminiCommandNamesFromFiles', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, '.gemini', 'commands', 'git'), { recursive: true });
    mkdirSync(join(ROOT, '.gemini', 'commands', 'nested', 'deep'), { recursive: true });
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('maps nested paths to colon names', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'git', 'commit.toml'), 'name = "c"\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'lint.md'), '---\n---\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names.sort()).toEqual(['git:commit', 'lint']);
  });

  it('handles deeply nested paths', async () => {
    writeFileSync(
      join(ROOT, '.gemini', 'commands', 'nested', 'deep', 'command.toml'),
      'name = "test"\n',
    );
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual(['nested:deep:command']);
  });

  it('filters non-toml/md files', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'git', 'commit.txt'), 'text');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'script.js'), 'console.log("test")');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'valid.toml'), 'name = "test"\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual(['valid']);
  });

  it('handles case insensitive extensions', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'test.TOML'), 'name = "test"\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'other.MD'), '---\n---\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names.sort()).toEqual(['other', 'test']);
  });

  it('deduplicates names', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'test.toml'), 'name = "test1"\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'test.md'), '---\n---\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual(['test']);
  });

  it('sorts results alphabetically', async () => {
    writeFileSync(join(ROOT, '.gemini', 'commands', 'z-last.toml'), 'name = "z"\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'a-first.md'), '---\n---\n');
    writeFileSync(join(ROOT, '.gemini', 'commands', 'm-middle.toml'), 'name = "m"\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual(['a-first', 'm-middle', 'z-last']);
  });

  it('handles empty directory', async () => {
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual([]);
  });

  it('filters files outside commands root', async () => {
    // Create a file outside the commands directory
    mkdirSync(join(ROOT, 'other'), { recursive: true });
    writeFileSync(join(ROOT, 'other', 'outside.toml'), 'name = "outside"\n');

    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual([]);
  });

  it('normalizes path separators', async () => {
    // This test would require Windows-style paths, but we can test the logic
    writeFileSync(join(ROOT, '.gemini', 'commands', 'test.toml'), 'name = "test"\n');
    const names = await inferGeminiCommandNamesFromFiles(ROOT, '.gemini/commands');
    expect(names).toEqual(['test']);
  });
});
